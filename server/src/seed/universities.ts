import "dotenv/config"
import mongoose from "mongoose"

import { UniversityModel } from "../models/University"

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
    console.error("DATABASE_URL is missing")
    process.exit(1)
}

const seedData = [
    {
        name: "Durham University",
        courses: [
            {
                name: "BSc Computer Science",
                modules: [
                    { moduleId: "COMP1081", name: "Algorithms and Data Structures", year: 1 },
                    { moduleId: "COMP1051", name: "Computational Thinking", year: 1 },
                    { moduleId: "COMP1071", name: "Computer Systems", year: 1 },
                    { moduleId: "COMP1021", name: "Mathematics for Computer Science", year: 1 },
                    { moduleId: "COMP1101", name: "Programming (Black)", year: 1 },
                    { moduleId: "COMP1111", name: "Programming (Gold)", year: 1 },
                    { moduleId: "COMP2211", name: "Networks and Systems", year: 2 },
                    { moduleId: "COMP2221", name: "Programming Paradigms", year: 2 },
                    { moduleId: "COMP2181", name: "Theory of Computation", year: 2 },
                    { moduleId: "COMP2261", name: "Artificial Intelligence", year: 2 },
                    { moduleId: "COMP2271", name: "Data Science", year: 2 },
                    { moduleId: "COMP2281", name: "Software Engineering", year: 2 },
                    { moduleId: "COMP3012", name: "Individual Project", year: 3 },
                    { moduleId: "COMP3477", name: "Algorithmic Game Theory", year: 3 },
                    { moduleId: "COMP3487", name: "Bioinformatics", year: 3 },
                    { moduleId: "COMP3637", name: "Compiler Design", year: 3 },
                    { moduleId: "COMP3507", name: "Computational Complexity", year: 3 },
                    {
                        moduleId: "COMP3517",
                        name: "Computational Modelling in the Humanities and Social Sciences",
                        year: 3
                    },
                    { moduleId: "COMP3421", name: "Computer Science into Schools", year: 3 },
                    { moduleId: "COMP3527", name: "Computer Vision", year: 3 },
                    { moduleId: "COMP3731", name: "Cryptography", year: 3 },
                    { moduleId: "COMP3547", name: "Deep Learning", year: 3 },
                    {
                        moduleId: "COMP3557",
                        name: "Design of Algorithms and Data Structures",
                        year: 3
                    },
                    {
                        moduleId: "COMP3647",
                        name: "Human-AI Interaction Design",
                        year: 3
                    },
                    {
                        moduleId: "COMP3751",
                        name: "Interactive Media, Gaming and VR/AR Technologies",
                        year: 3
                    },
                    { moduleId: "COMP3721", name: "Introduction to Music Computing", year: 3 },
                    { moduleId: "COMP3677", name: "Natural Computing Algorithms", year: 3 },
                    { moduleId: "COMP3741", name: "Parallel Scientific Computing", year: 3 },
                    { moduleId: "COMP3587", name: "Project Management", year: 3 },
                    { moduleId: "COMP3607", name: "Recommender Systems", year: 3 },
                    { moduleId: "COMP3667", name: "Reinforcement Learning", year: 3 }
                ]
            }
        ]
    }
]

const run = async () => {
    try {
        await mongoose.connect(DATABASE_URL)
        await UniversityModel.deleteMany({})
        await UniversityModel.insertMany(seedData)
        console.log("Seeded universities")
    } catch (err) {
        console.error("Seed failed", err)
        process.exitCode = 1
    } finally {
        await mongoose.disconnect()
    }
}

void run()
