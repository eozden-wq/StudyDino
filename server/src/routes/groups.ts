/// <reference path="../types/transformers-dist.d.ts" />
import "dotenv/config"

if (!process.env.TRANSFORMERS_DISABLE_SHARP) {
    process.env.TRANSFORMERS_DISABLE_SHARP = "1"
}
import { Router } from "express"
import type { Request, Response } from "express"

import { GroupModel } from "../models/Group"
import { UniversityModel } from "../models/University"
import { UserModel } from "../models/User"

const router: Router = Router()

const TRANSFORMERS_MODEL = process.env.TRANSFORMERS_MODEL ?? "Xenova/all-MiniLM-L6-v2"
const VECTOR_INDEX = process.env.VECTOR_INDEX ?? "groups_interest_vector"
const VECTOR_FIELD = "interestEmbedding"

type FeatureExtractionPipeline = (input: string, options: { pooling: "mean"; normalize: boolean }) => Promise<{
    data: ArrayLike<number>
}>

let embeddingPipeline: FeatureExtractionPipeline | null = null

type AuthRequest = Request & {
    auth?: {
        payload?: {
            sub?: string
        }
    }
}

type CreateGroupPayload = {
    name?: string
    startAt?: string
    endAt?: string
    location?: {
        lat?: number
        lng?: number
    }
    interest?: string
    module?: {
        moduleId?: string
        name?: string
        course?: string
        university?: string
    }
}

type GroupSearchPayload = {
    query?: string
    limit?: number
}

const getAuth0Id = (req: AuthRequest) => req.auth?.payload?.sub

const parseDate = (value?: string) => {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isNonEmptyString = (value?: string) => typeof value === "string" && value.trim().length > 0

const getEmbeddingPipeline = async (): Promise<FeatureExtractionPipeline> => {
    if (embeddingPipeline) return embeddingPipeline

    if (!process.env.TRANSFORMERS_DISABLE_SHARP) {
        process.env.TRANSFORMERS_DISABLE_SHARP = "1"
    }

    const transformers = await import("@xenova/transformers")
    const env = (transformers as { env?: { allowLocalModels?: boolean; allowRemoteModels?: boolean; useFS?: boolean; useFSCache?: boolean } }).env
    if (env) {
        env.allowLocalModels = false
        env.allowRemoteModels = true
        env.useFS = false
        env.useFSCache = false
    }
    const { pipeline } = transformers as {
        pipeline: (task: string, model?: string) => Promise<FeatureExtractionPipeline>
    }
    const instance = await pipeline("feature-extraction", TRANSFORMERS_MODEL)
    embeddingPipeline = instance
    return instance
}

const getInterestEmbedding = async (value: string) => {
    const embed = await getEmbeddingPipeline()
    const result = await embed(value, { pooling: "mean", normalize: true })
    const vector = Array.from(result.data, (item) => Number(item))
    if (vector.length === 0) {
        throw new Error("Local embeddings returned no data")
    }

    return vector
}

const moduleExistsInUniversity = async (params: {
    universityName: string
    courseName: string
    moduleId: string
    moduleName: string
}) => {
    const university = await UniversityModel.findOne({ name: params.universityName }).lean()
    if (!university) return false

    const course = university.courses.find((entry) => entry.name === params.courseName)
    if (!course) return false

    return course.modules.some(
        (module) => module.moduleId === params.moduleId && module.name === params.moduleName
    )
}

const getOrCreateUser = async (auth0Id: string) => {
    const existing = await UserModel.findOne({ auth0Id })
    if (existing) return existing
    return UserModel.create({ auth0Id })
}

router.get("/groups", async (_req: Request, res: Response) => {
    const groups = await GroupModel.find().sort({ createdAt: -1 }).lean()
    return res.json({ data: groups })
})

router.get("/groups/me", async (req: AuthRequest, res: Response) => {
    const auth0Id = getAuth0Id(req)
    if (!auth0Id) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const user = await UserModel.findOne({ auth0Id }).lean()
    if (!user?.currentGroupId) {
        return res.json({ data: null })
    }

    const group = await GroupModel.findById(user.currentGroupId).lean()
    return res.json({ data: group ?? null })
})

router.post("/groups/search", async (req: AuthRequest, res: Response) => {
    try {
        const payload = req.body as GroupSearchPayload
        const query = typeof payload.query === "string" ? payload.query.trim() : ""
        const limit =
            typeof payload.limit === "number" && payload.limit > 0
                ? Math.min(payload.limit, 50)
                : 20

        if (!query) {
            return res.status(400).json({ error: "query is required" })
        }

        const queryVector = await getInterestEmbedding(query)
        const results = await GroupModel.aggregate([
            {
                $vectorSearch: {
                    index: VECTOR_INDEX,
                    path: VECTOR_FIELD,
                    queryVector,
                    numCandidates: Math.max(limit * 5, 50),
                    limit
                }
            },
            {
                $project: {
                    score: { $meta: "vectorSearchScore" },
                    name: 1,
                    creator: 1,
                    members: 1,
                    startAt: 1,
                    endAt: 1,
                    location: 1,
                    interest: 1,
                    module: 1
                }
            }
        ])

        return res.json({ data: results })
    } catch (err) {
        console.error("Vector search failed", err)
        return res.status(500).json({ error: "Vector search failed" })
    }
})

router.post("/groups", async (req: AuthRequest, res: Response) => {
    const auth0Id = getAuth0Id(req)
    if (!auth0Id) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const user = await getOrCreateUser(auth0Id)
    if (user.currentGroupId) {
        return res.status(409).json({ error: "User already in a group" })
    }

    const payload = req.body as CreateGroupPayload
    const name = typeof payload.name === "string" ? payload.name.trim() : ""
    const startAt = parseDate(payload.startAt)
    const endAt = parseDate(payload.endAt)

    if (!name) {
        return res.status(400).json({ error: "name is required" })
    }

    if (!startAt || !endAt) {
        return res.status(400).json({ error: "startAt and endAt are required" })
    }

    if (endAt <= startAt) {
        return res.status(400).json({ error: "endAt must be after startAt" })
    }

    const lat = payload.location?.lat
    const lng = payload.location?.lng

    if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "location lat/lng are required" })
    }

    const hasInterest = isNonEmptyString(payload.interest)
    const hasModule = !!payload.module

    if (hasInterest === hasModule) {
        return res.status(400).json({ error: "Provide either interest or module" })
    }

    let moduleData: { moduleId: string; name: string; course: string; university?: string } | undefined
    if (hasModule && payload.module) {
        const { moduleId, name, course } = payload.module
        if (!isNonEmptyString(moduleId) || !isNonEmptyString(name) || !isNonEmptyString(course)) {
            return res.status(400).json({ error: "moduleId, name, and course are required" })
        }

        if (!isNonEmptyString(user.university)) {
            return res.status(400).json({ error: "User university is required for module groups" })
        }

        const moduleExists = await moduleExistsInUniversity({
            universityName: user.university.trim(),
            courseName: course!.trim(),
            moduleId: moduleId!.trim(),
            moduleName: name!.trim()
        })

        if (!moduleExists) {
            return res.status(400).json({ error: "Module not found in user's university" })
        }

        moduleData = {
            moduleId: moduleId!.trim(),
            name: name!.trim(),
            course: course!.trim(),
            university: user.university.trim()
        }
    }

    const interestText = hasInterest ? (payload.interest?.trim() ?? "") : ""
    const interestEmbedding: number[] | null = hasInterest
        ? await getInterestEmbedding(interestText)
        : null

    const group = await GroupModel.create({
        name,
        creator: user._id,
        members: [user._id],
        startAt,
        endAt,
        location: { type: "Point", coordinates: [lng, lat] },
        interest: hasInterest ? interestText : null,
        interestEmbedding,
        module: moduleData ?? null
    })

    user.currentGroupId = group._id
    await user.save()

    return res.status(201).json({ data: group })
})

router.post("/groups/:id/join", async (req: AuthRequest, res: Response) => {
    const auth0Id = getAuth0Id(req)
    if (!auth0Id) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const user = await getOrCreateUser(auth0Id)
    if (user.currentGroupId) {
        return res.status(409).json({ error: "User already in a group" })
    }

    const group = await GroupModel.findById(req.params.id)
    if (!group) {
        return res.status(404).json({ error: "Group not found" })
    }

    const alreadyMember = group.members.some((memberId) => memberId.equals(user._id))
    if (alreadyMember) {
        return res.status(409).json({ error: "User already in group" })
    }

    group.members.push(user._id)
    await group.save()

    user.currentGroupId = group._id
    await user.save()

    return res.json({ data: group })
})

router.post("/groups/:id/leave", async (req: AuthRequest, res: Response) => {
    const auth0Id = getAuth0Id(req)
    if (!auth0Id) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const user = await UserModel.findOne({ auth0Id })
    if (!user?.currentGroupId) {
        return res.status(409).json({ error: "User is not in a group" })
    }

    const group = await GroupModel.findById(req.params.id)
    if (!group) {
        user.currentGroupId = null
        await user.save()
        return res.status(404).json({ error: "Group not found" })
    }

    if (!user.currentGroupId.equals(group._id)) {
        return res.status(409).json({ error: "User is not in this group" })
    }

    const isMember = group.members.some((memberId) => memberId.equals(user._id))
    if (!isMember) {
        user.currentGroupId = null
        await user.save()
        return res.status(409).json({ error: "User is not in this group" })
    }

    if (group.creator.equals(user._id)) {
        return res.status(400).json({ error: "Creator cannot leave their group" })
    }

    group.members = group.members.filter((memberId) => !memberId.equals(user._id))
    await group.save()

    user.currentGroupId = null
    await user.save()

    return res.json({ data: group })
})

export default router
