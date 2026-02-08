import { Schema, model, type InferSchemaType, Types } from "mongoose"

type GroupMessagePayload = {
    groupId: Types.ObjectId
    sender: Types.ObjectId
    text: string
    createdAt: Date
}

const groupMessageSchema = new Schema<GroupMessagePayload>(
    {
        groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
        sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true, trim: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now, index: true }
    },
    { timestamps: false }
)

groupMessageSchema.index({ groupId: 1, createdAt: -1 })

export type GroupMessage = InferSchemaType<typeof groupMessageSchema>

export const GroupMessageModel = model("GroupMessage", groupMessageSchema)
