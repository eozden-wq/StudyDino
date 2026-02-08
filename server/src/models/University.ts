import { Schema, model, type InferSchemaType } from "mongoose"

type Module = {
    moduleId: string
    name: string
    year: number
}

type Course = {
    name: string
    modules: Module[]
}

const moduleSchema = new Schema<Module>(
    {
        moduleId: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        year: { type: Number, required: true, min: 1 }
    },
    { _id: false }
)

const courseSchema = new Schema<Course>(
    {
        name: { type: String, required: true, trim: true },
        modules: { type: [moduleSchema], default: [] }
    },
    { _id: false }
)

const universitySchema = new Schema(
    {
        name: { type: String, required: true, trim: true, unique: true },
        courses: { type: [courseSchema], default: [] }
    },
    { timestamps: true }
)

export type University = InferSchemaType<typeof universitySchema>

export const UniversityModel = model("University", universitySchema)
