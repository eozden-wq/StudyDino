import { Schema, model, type InferSchemaType, Types } from "mongoose"

type GroupModule = {
    moduleId: string
    name: string
    course: string
    university?: string
}

type GroupLocation = {
    type: "Point"
    coordinates: [number, number]
}

const groupModuleSchema = new Schema<GroupModule>(
    {
        moduleId: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
        course: { type: String, required: true, trim: true },
        university: { type: String, trim: true }
    },
    { _id: false }
)

const groupLocationSchema = new Schema<GroupLocation>(
    {
        type: { type: String, enum: ["Point"], default: "Point", required: true },
        coordinates: { type: [Number], required: true }
    },
    { _id: false }
)

const groupSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
        members: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
        startAt: { type: Date, required: true },
        endAt: { type: Date, required: true },
        location: { type: groupLocationSchema, required: true },
        interest: { type: String, trim: true },
        module: { type: groupModuleSchema }
    },
    { timestamps: true }
)

groupSchema.index({ location: "2dsphere" })

groupSchema.path("members").validate((value: Types.ObjectId[]) => value.length > 0)

groupSchema.path("interest").validate(function (this: InferSchemaType<typeof groupSchema>) {
    const hasInterest = typeof this.interest === "string" && this.interest.trim().length > 0
    const hasModule = !!this.module
    return (hasInterest && !hasModule) || (!hasInterest && hasModule)
})

groupSchema.path("module").validate(function (this: InferSchemaType<typeof groupSchema>) {
    const hasInterest = typeof this.interest === "string" && this.interest.trim().length > 0
    const hasModule = !!this.module
    return (hasInterest && !hasModule) || (!hasInterest && hasModule)
})

export type Group = InferSchemaType<typeof groupSchema>

export const GroupModel = model("Group", groupSchema)
