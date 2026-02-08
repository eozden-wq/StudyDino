// src/server.ts
import express from 'express';
import http, { type IncomingMessage } from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { auth } from 'express-oauth2-jwt-bearer';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import meRoutes from './routes/me';
import universityRoutes from './routes/universities';
import groupRoutes from './routes/groups';
import { GroupModel } from './models/Group';
import { UserModel } from './models/User';
import { GroupMessageModel } from './models/GroupMessage';
import { broadcastToGroup, registerSocket, unregisterSocket } from './realtime';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const HOST = process.env.HOST || "0.0.0.0";
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

// Middleware
app.use(
    cors({
        origin: true,
        credentials: true,
        allowedHeaders: ["Authorization", "Content-Type"],
    })
);
app.use(express.json());

if (!AUTH0_DOMAIN || !AUTH0_AUDIENCE) {
    console.warn('AUTH0_DOMAIN or AUTH0_AUDIENCE is missing. Auth routes will fail.');
}

const checkJwt = AUTH0_DOMAIN && AUTH0_AUDIENCE
    ? auth({
        issuerBaseURL: `https://${AUTH0_DOMAIN}/`,
        audience: AUTH0_AUDIENCE,
    })
    : (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();

// MongoDB Connection
mongoose
    .connect(process.env.DATABASE_URL as string)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));

const cleanupGroups = async () => {
    const now = new Date();
    const groupsToDelete = await GroupModel.find(
        {
            $or: [
                { endAt: { $lt: now } },
                { members: { $size: 0 } }
            ]
        },
        { _id: 1 }
    ).lean();

    if (groupsToDelete.length === 0) return;

    const groupIds = groupsToDelete.map((group) => group._id);
    await UserModel.updateMany(
        { currentGroupId: { $in: groupIds } },
        { $set: { currentGroupId: null } }
    );
    await GroupMessageModel.deleteMany({ groupId: { $in: groupIds } });
    await GroupModel.deleteMany({ _id: { $in: groupIds } });
};

const scheduleCleanup = () => {
    const intervalMs = 5 * 60 * 1000;
    void cleanupGroups();
    setInterval(() => {
        void cleanupGroups();
    }, intervalMs);
};

mongoose.connection.once("open", () => {
    scheduleCleanup();
});

const jwks = AUTH0_DOMAIN
    ? createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`))
    : null;

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host ?? "localhost"}`);
    const token = url.searchParams.get("token") ?? "";
    const groupId = url.searchParams.get("groupId") ?? "";

    const closeWithPolicy = () => socket.close(1008, "Unauthorized");

    if (!token || !groupId || !jwks || !AUTH0_DOMAIN || !AUTH0_AUDIENCE) {
        closeWithPolicy();
        return;
    }

    const setupConnection = async () => {
        try {
            const { payload } = await jwtVerify(token, jwks, {
                issuer: `https://${AUTH0_DOMAIN}/`,
                audience: AUTH0_AUDIENCE
            });

            const auth0Id = typeof payload.sub === "string" ? payload.sub : "";
            if (!auth0Id) {
                closeWithPolicy();
                return;
            }

            const user = await UserModel.findOne({ auth0Id }).lean();
            if (!user?.currentGroupId || String(user.currentGroupId) !== groupId) {
                closeWithPolicy();
                return;
            }

            const senderName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Member";

            registerSocket(groupId, socket);

            const history = await GroupMessageModel.find({ groupId })
                .sort({ createdAt: -1 })
                .limit(20)
                .populate("sender", "firstName lastName")
                .lean();

            const formattedHistory = history
                .map((message) => {
                    const sender = message.sender as { _id?: unknown; firstName?: string; lastName?: string } | undefined;
                    const name = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") || "Member";
                    return {
                        id: String(message._id),
                        text: message.text,
                        createdAt: message.createdAt,
                        senderId: sender?._id ? String(sender._id) : null,
                        senderName: name
                    };
                })
                .reverse();

            socket.send(JSON.stringify({ type: "history", messages: formattedHistory }));

            socket.on("message", async (raw: RawData) => {
                try {
                    const parsed = JSON.parse(raw.toString());
                    if (parsed?.type !== "message" || typeof parsed.text !== "string") return;
                    const text = parsed.text.trim();
                    if (!text) return;
                    const created = await GroupMessageModel.create({
                        groupId,
                        sender: user._id,
                        text
                    });

                    const payload = {
                        type: "message",
                        message: {
                            id: String(created._id),
                            text: created.text,
                            createdAt: created.createdAt,
                            senderId: String(user._id),
                            senderName
                        }
                    };

                    broadcastToGroup(groupId, payload);
                } catch {
                    return;
                }
            });

            socket.on("close", () => {
                unregisterSocket(groupId, socket);
            });
        } catch {
            closeWithPolicy();
        }
    };

    void setupConnection();
});

// Routes
app.get('/', (_req, res) => {
    res.send('API is running...');
});

app.use(checkJwt);
app.use(meRoutes);
app.use(universityRoutes);
app.use(groupRoutes);

server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
