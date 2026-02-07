import { Router } from "express"
import type { Request, Response } from "express"

import { UserModel } from "../models/User"

const router: Router = Router()

type AuthRequest = Request & {
    auth?: {
        payload?: {
            sub?: string
        }
    }
}

const getAuth0Id = (req: AuthRequest) => req.auth?.payload?.sub

router.get("/me", async (req: AuthRequest, res: Response) => {
    const auth0Id = getAuth0Id(req)
    if (!auth0Id) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const user = await UserModel.findOne({ auth0Id }).lean()
    if (!user) {
        return res.status(404).json({ error: "User not found" })
    }

    return res.json({ data: user })
})

router.patch("/me", async (req: AuthRequest, res: Response) => {
    const auth0Id = getAuth0Id(req)
    if (!auth0Id) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const payload = req.body as Partial<{
        firstName: string
        lastName: string
        university: string
        course: string
        year: number
    }>

    const update: Record<string, unknown> = {}

    if (typeof payload.firstName === "string") update.firstName = payload.firstName
    if (typeof payload.lastName === "string") update.lastName = payload.lastName
    if (typeof payload.university === "string") update.university = payload.university
    if (typeof payload.course === "string") update.course = payload.course
    if (typeof payload.year === "number") update.year = payload.year

    if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: "No valid fields provided" })
    }

    const user = await UserModel.findOneAndUpdate(
        { auth0Id },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()

    return res.json({ data: user })
})

export default router
