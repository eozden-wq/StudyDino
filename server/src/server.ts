// src/server.ts
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { auth } from 'express-oauth2-jwt-bearer';

import meRoutes from './routes/me';
import universityRoutes from './routes/universities';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
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

// Routes
app.get('/', (_req, res) => {
    res.send('API is running...');
});

app.use(checkJwt);
app.use(meRoutes);
app.use(universityRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
