import { Router } from "express"
import type { Request, Response } from "express"

import { GroupModel } from "../models/Group"
import { UniversityModel } from "../models/University"
import { UserModel } from "../models/User"

const router: Router = Router()

type AuthRequest = Request & {
    auth?: {
        payload?: {
            sub?: string
        }
    }
}

type CreateGroupPayload = {
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

const getAuth0Id = (req: AuthRequest) => req.auth?.payload?.sub

const parseDate = (value?: string) => {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isNonEmptyString = (value?: string) => typeof value === "string" && value.trim().length > 0

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
    const startAt = parseDate(payload.startAt)
    const endAt = parseDate(payload.endAt)

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

    const group = await GroupModel.create({
        creator: user._id,
        members: [user._id],
        startAt,
        endAt,
        location: { type: "Point", coordinates: [lng, lat] },
        interest: hasInterest ? (payload.interest?.trim() ?? null) : null,
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
