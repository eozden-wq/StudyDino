import "dotenv/config"
import mongoose from "mongoose"

import { GroupModel } from "../models/Group"
import { UserModel } from "../models/User"

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
    console.error("DATABASE_URL is missing")
    process.exit(1)
}

const seedUsers = [
    {
        auth0Id: "seed|alice",
        firstName: "Alice",
        lastName: "Smith",
        university: "Durham University",
        course: "BSc Computer Science",
        year: 3
    },
    {
        auth0Id: "seed|bob",
        firstName: "Bob",
        lastName: "Johnson",
        university: "Durham University",
        course: "BSc Computer Science",
        year: 2
    },
    {
        auth0Id: "seed|carla",
        firstName: "Carla",
        lastName: "Nguyen",
        university: "Durham University",
        course: "BSc Computer Science",
        year: 3
    },
    {
        auth0Id: "seed|dave",
        firstName: "Dave",
        lastName: "Patel",
        university: "Durham University",
        course: "BSc Computer Science",
        year: 3
    },
    {
        auth0Id: "seed|ella",
        firstName: "Ella",
        lastName: "Khan",
        university: "Durham University",
        course: "BSc Computer Science",
        year: 1
    },
    {
        auth0Id: "seed|finn",
        firstName: "Finn",
        lastName: "Wright",
        university: "Durham University",
        course: "BSc Computer Science",
        year: 2
    }
]

const buildDate = (offsetHours: number) => new Date(Date.now() + offsetHours * 60 * 60 * 1000)

const seedGroups = [
    {
        creator: "seed|alice",
        members: ["seed|alice", "seed|bob"],
        startAt: buildDate(2),
        endAt: buildDate(4),
        location: { type: "Point", coordinates: [-1.5747, 54.7753] },
        interest: "Algorithms revision"
    },
    {
        creator: "seed|carla",
        members: ["seed|carla"],
        startAt: buildDate(24),
        endAt: buildDate(26),
        location: { type: "Point", coordinates: [-1.577, 54.7683] },
        module: {
            moduleId: "COMP3477",
            name: "Algorithmic Game Theory",
            course: "BSc Computer Science",
            university: "Durham University"
        }
    },
    {
        creator: "seed|dave",
        members: ["seed|dave", "seed|ella"],
        startAt: buildDate(48),
        endAt: buildDate(50),
        location: { type: "Point", coordinates: [-1.5786, 54.7713] },
        module: {
            moduleId: "COMP3527",
            name: "Computer Vision",
            course: "BSc Computer Science",
            university: "Durham University"
        }
    },
    {
        creator: "seed|finn",
        members: ["seed|finn"],
        startAt: buildDate(6),
        endAt: buildDate(8),
        location: { type: "Point", coordinates: [-1.5762, 54.7732] },
        interest: "Study sprint"
    }
]

const run = async () => {
    try {
        await mongoose.connect(DATABASE_URL)

        await GroupModel.deleteMany({})
        await UserModel.deleteMany({ auth0Id: /^seed\|/ })

        const users = await UserModel.insertMany(seedUsers)
        const usersByAuth0Id = new Map(users.map((user) => [user.auth0Id, user]))

        for (const group of seedGroups) {
            const creator = usersByAuth0Id.get(group.creator)
            if (!creator) {
                throw new Error(`Missing creator user for ${group.creator}`)
            }

            const memberIds = group.members.map((auth0Id) => {
                const member = usersByAuth0Id.get(auth0Id)
                if (!member) {
                    throw new Error(`Missing member user for ${auth0Id}`)
                }
                return member._id
            })

            const createdGroup = await GroupModel.create({
                creator: creator._id,
                members: memberIds,
                startAt: group.startAt,
                endAt: group.endAt,
                location: group.location,
                interest: group.interest ?? null,
                module: group.module ?? null
            })

            await UserModel.updateMany(
                { _id: { $in: memberIds } },
                { $set: { currentGroupId: createdGroup._id } }
            )
        }

        console.log(`Seeded ${seedGroups.length} groups and ${seedUsers.length} users`)
    } catch (err) {
        console.error("Seed failed", err)
        process.exitCode = 1
    } finally {
        await mongoose.disconnect()
    }
}

void run()
