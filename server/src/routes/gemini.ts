import { Router } from "express";
import type { Request, Response } from "express";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { UserModel } from "../models/User";
import { auth } from 'express-oauth2-jwt-bearer';
import { GroupModel } from "../models/Group";

const router: Router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash", 
    generationConfig: {
        maxOutputTokens: 200, 
        temperature: 0.7,
        responseMimeType: "application/json"
    },
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
});

// ... [Keep helper functions: AuthPayload, getAuth0Id, resolveNamesFromAuth, getOrCreateUser, checkJwt] ...
type AuthPayload = {
    sub?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    nickname?: string;
    preferred_username?: string;
    email?: string;
};

type AuthRequest = Request & {
    auth?: {
        payload?: AuthPayload;
    };
};

const getAuthPayload = (req: Request) =>
    (req as { auth?: { payload?: AuthPayload } }).auth?.payload;

const getAuth0Id = (req: Request) => getAuthPayload(req)?.sub;

const resolveNamesFromAuth = (payload?: AuthPayload, auth0Id?: string) => {
    const firstName = typeof payload?.given_name === "string" ? payload.given_name.trim() : "";
    const lastName = typeof payload?.family_name === "string" ? payload.family_name.trim() : "";
    if (firstName || lastName) {
        return { firstName, lastName };
    }
    const fullName = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (fullName) {
        const [first, ...rest] = fullName.split(" ");
        return { firstName: first ?? "", lastName: rest.join(" ") };
    }
    const fallback =
        (typeof payload?.preferred_username === "string" && payload.preferred_username.trim()) ||
        (typeof payload?.nickname === "string" && payload.nickname.trim()) ||
        "";
    if (fallback) {
        return { firstName: fallback, lastName: "" };
    }
    return { firstName: "", lastName: "" };
};

const getOrCreateUser = async (auth0Id: string, payload?: AuthPayload) => {
    const resolved = resolveNamesFromAuth(payload, auth0Id);
    const existing = await UserModel.findOne({ auth0Id });
    if (existing) {
        const nextFirst = resolved.firstName || existing.firstName;
        const nextLast = resolved.lastName || existing.lastName;
        if (nextFirst !== existing.firstName || nextLast !== existing.lastName) {
            existing.firstName = nextFirst;
            existing.lastName = nextLast;
            await existing.save();
        }
        return existing;
    }
    if (!resolved.firstName && !resolved.lastName) {
        const fallbackId = auth0Id.split("|").pop() ?? auth0Id;
        return UserModel.create({
            auth0Id,
            firstName: `User ${fallbackId.slice(-6)}`,
            lastName: ""
        });
    }
    return UserModel.create({ auth0Id, ...resolved });
};

const checkJwt = process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE
    ? auth({
        issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
        audience: process.env.AUTH0_AUDIENCE,
    })
    : (_req: Request, _res: Response, next: () => void) => next();


// --- ROUTE ---

router.post("/gemini/recommendations", checkJwt, async (req: AuthRequest, res: Response) => {
    try {
        if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Server misconfiguration" });
        const auth0Id = getAuth0Id(req);
        if (!auth0Id) return res.status(401).json({ error: "Unauthorized" });
        await getOrCreateUser(auth0Id, getAuthPayload(req));
        
        const { prompt: userPrompt } = req.body;
        if (!userPrompt) return res.status(400).json({ error: "Missing prompt" });

        // 1. Fetch data
        const existingGroups = await GroupModel.find({}, '_id name interest members startAt endAt location').lean();
        
        const groupInfo = existingGroups.map(group => ({
            id: group._id, 
            name: group.name,
            interest: group.interest || "General Study", 
            memberCount: group.members?.length || 0,
            startAt: group.startAt,
            endAt: group.endAt
        }));

        // 2. Structured Prompt with "Create Group" logic
        const prompt = `
        User Input: "${userPrompt}"
        Available Groups: ${JSON.stringify(groupInfo)}

        Task: Recommend a study group or suggest creating one.
        Output Format: JSON object with keys:
        - "response_text": A concise, friendly message (max 3 sentences).
        - "suggested_group_id": The exact 'id' of the single most relevant group from the list, or null if none match.
        - "suggest_create_group": Boolean. Set to true if the user explicitly asks to create a group OR if no existing groups match their interest. Otherwise false.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text(); 
        
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(text);
        } catch (e) {
            jsonResponse = { 
                response_text: text, 
                suggested_group_id: null,
                suggest_create_group: false
            };
        }

        // 3. Hydrate response
        let hydratedData = { ...jsonResponse, group_details: null };

        if (jsonResponse.suggested_group_id) {
            const fullGroup = existingGroups.find(g => g._id.toString() === jsonResponse.suggested_group_id);
            if (fullGroup) {
                hydratedData.group_details = {
                    id: fullGroup._id,
                    name: fullGroup.name,
                    startAt: fullGroup.startAt,
                    endAt: fullGroup.endAt,
                    coordinates: fullGroup.location?.coordinates 
                };
            }
        }

        return res.json({ data: hydratedData });

    } catch (error: any) {
        console.error("Error in Gemini endpoint:", error);
        return res.status(500).json({ error: "Failed to get recommendations." });
    }
});

export default router;