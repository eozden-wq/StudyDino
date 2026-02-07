import { useEffect, useMemo, useState } from "react"
import { Moon, Sun } from "lucide-react"

import BackButton from "@/components/routing/BackButton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const INTEREST_OPTIONS = [
    "Productivity",
    "Design",
    "Outdoors",
    "Gaming",
    "Reading",
    "Music",
    "Fitness",
    "Photography",
]

type ThemeMode = "light" | "dark"

const THEME_STORAGE_KEY = "studydino-theme"

const INSTITUTION_NAME = "Durham University"
const COURSE_NAME = "BSc Computer Science"
const YEAR_OF_STUDY_OPTIONS = ["1", "2", "3", "4"]

const getInitialTheme = (): ThemeMode => {
    if (typeof document === "undefined" || typeof window === "undefined") {
        return "light"
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === "dark" || storedTheme === "light") {
        return storedTheme
    }

    const root = document.documentElement
    if (root.classList.contains("dark")) return "dark"
    if (root.classList.contains("light")) return "light"

    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
}

export default function ProfileView() {
    const [firstName, setFirstName] = useState("Avery")
    const [lastName, setLastName] = useState("Nguyen")
    const [email, setEmail] = useState("avery.nguyen@example.com")
    const [selectedInterest, setSelectedInterest] = useState(
        INTEREST_OPTIONS[0]
    )
    const [interests, setInterests] = useState<string[]>(["Design", "Reading"])
    const [yearOfStudy, setYearOfStudy] = useState("2")
    const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme)

    const availableInterests = useMemo(
        () => INTEREST_OPTIONS.filter((option) => !interests.includes(option)),
        [interests]
    )

    const handleAddInterest = () => {
        if (!selectedInterest) return
        if (interests.includes(selectedInterest)) return
        setInterests((prev) => {
            const next = [...prev, selectedInterest]
            const nextAvailable = INTEREST_OPTIONS.filter(
                (option) => !next.includes(option)
            )
            setSelectedInterest(nextAvailable[0] ?? "")
            return next
        })
    }

    const handleRemoveInterest = (interest: string) => {
        setInterests((prev) => {
            const next = prev.filter((item) => item !== interest)
            const nextAvailable = INTEREST_OPTIONS.filter(
                (option) => !next.includes(option)
            )
            setSelectedInterest(nextAvailable[0] ?? "")
            return next
        })
    }

    useEffect(() => {
        if (typeof document === "undefined") return
        const root = document.documentElement
        root.classList.toggle("dark", themeMode === "dark")
        root.classList.toggle("light", themeMode === "light")
        if (typeof window !== "undefined") {
            window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
        }
    }, [themeMode])

    return (
        <div className="relative min-h-screen bg-background px-5 pb-24 pt-16 text-foreground">
            <BackButton />
            <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold">Profile</h1>
                    <p className="text-sm text-muted-foreground">
                        View and update your personal details.
                    </p>
                </header>

                <section className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="first-name">Name</Label>
                        <Input
                            id="first-name"
                            value={firstName}
                            onChange={(event) => setFirstName(event.target.value)}
                            placeholder="Enter your name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="last-name">Surname</Label>
                        <Input
                            id="last-name"
                            value={lastName}
                            onChange={(event) => setLastName(event.target.value)}
                            placeholder="Enter your surname"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@example.com"
                        />
                    </div>
                </section>

                <section className="space-y-4">
                    <div>
                        <p className="text-sm font-medium">Study details</p>
                        <p className="text-sm text-muted-foreground">
                            Information so we can make suggestions based on what
                            you're studying!
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="institution-name">Institution</Label>
                        <Input
                            id="institution-name"
                            value={INSTITUTION_NAME}
                            readOnly
                            className="cursor-default"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="course-name">Course</Label>
                        <Input
                            id="course-name"
                            value={COURSE_NAME}
                            readOnly
                            className="cursor-default"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="year-of-study">Year of study</Label>
                        <select
                            id="year-of-study"
                            value={yearOfStudy}
                            onChange={(event) => setYearOfStudy(event.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {YEAR_OF_STUDY_OPTIONS.map((year) => (
                                <option key={year} value={year}>
                                    Year {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </section>

                <section className="space-y-4">
                    <div>
                        <p className="text-sm font-medium">Interests</p>
                        <p className="text-sm text-muted-foreground">
                            Add up to a few interests to personalize suggestions,
                            for when you want to have fun!
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="w-full">
                            <Label htmlFor="interest-select" className="sr-only">
                                Interest
                            </Label>
                            <select
                                id="interest-select"
                                value={selectedInterest}
                                onChange={(event) => setSelectedInterest(event.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                {availableInterests.length === 0 ? (
                                    <option value="" disabled>
                                        All interests added
                                    </option>
                                ) : (
                                    availableInterests.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleAddInterest}
                            disabled={availableInterests.length === 0}
                        >
                            Add interest
                        </Button>
                    </div>
                    {interests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No interests selected yet.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {interests.map((interest) => (
                                <div
                                    key={interest}
                                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm"
                                >
                                    <span>{interest}</span>
                                    <button
                                        type="button"
                                        className="text-muted-foreground transition hover:text-foreground"
                                        onClick={() => handleRemoveInterest(interest)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <div className="mt-auto">
                    <Button variant="destructive" className="w-full">
                        Sign out
                    </Button>
                </div>
            </div>
            <div className="absolute bottom-4 left-4 z-10">
                <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0"
                    onClick={() =>
                        setThemeMode((prev) =>
                            prev === "dark" ? "light" : "dark"
                        )
                    }
                    aria-label={
                        themeMode === "dark"
                            ? "Switch to light mode"
                            : "Switch to dark mode"
                    }
                >
                    {themeMode === "dark" ? (
                        <Sun className="h-5 w-5" />
                    ) : (
                        <Moon className="h-5 w-5" />
                    )}
                </Button>
            </div>
        </div>
    )
}