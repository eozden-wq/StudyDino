import { Schema, model, type InferSchemaType } from "mongoose"

const userSchema = new Schema(
    {
        auth0Id: { type: String, required: true, unique: true, index: true },
        firstName: { type: String, trim: true, default: "" },
        lastName: { type: String, trim: true, default: "" },
        university: { type: String, trim: true, default: "" },
        course: { type: String, trim: true, default: "" },
        year: { type: Number, min: 1 },
        currentGroupId: { type: Schema.Types.ObjectId, ref: "Group", default: null }
    },
    { timestamps: true }
)

export type User = InferSchemaType<typeof userSchema>

export const UserModel = model("User", userSchema)
