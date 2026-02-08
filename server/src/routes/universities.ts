import { Router } from "express"
import type { Request, Response } from "express"

import { UniversityModel } from "../models/University"

const router: Router = Router()

router.get("/universities", async (_req: Request, res: Response) => {
    const universities = await UniversityModel.find().sort({ name: 1 }).lean()
    return res.json({ data: universities })
})

export default router
