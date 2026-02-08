import { useEffect, useMemo, useState } from "react"
import { useAuth0 } from "@auth0/auth0-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { apiRequest, ApiError } from "@/lib/api"

type OnboardingGateProps = {
    children: React.ReactNode
}

type MeResponse = {
    data: {
        university?: string
        course?: string
        year?: number
    }
}

type UniversityModule = {
    moduleId: string
    name: string
    year: number
}

type UniversityCourse = {
    name: string
    modules: UniversityModule[]
}

type University = {
    name: string
    courses: UniversityCourse[]
}

const formatApiError = (error: ApiError) => {
    const body =
        typeof error.body === "string"
            ? error.body
            : error.body
                ? JSON.stringify(error.body)
                : ""
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ""
    return `status=${error.status} ${body} api=${apiBase}`.trim()
}

const formatUnknownError = (error: unknown) => {
    if (error instanceof Error) {
        return error.message
    }
    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

export function OnboardingGate({ children }: OnboardingGateProps) {
    const { isAuthenticated, getAccessTokenSilently } = useAuth0()
    const [isChecking, setIsChecking] = useState(true)
    const [needsOnboarding, setNeedsOnboarding] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [errorDetails, setErrorDetails] = useState<string | null>(null)
    const [isCatalogLoading, setIsCatalogLoading] = useState(false)

    const [university, setUniversity] = useState("")
    const [course, setCourse] = useState("")
    const [year, setYear] = useState("")
    const [catalog, setCatalog] = useState<University[]>([])

    useEffect(() => {
        if (!isAuthenticated) return

        const checkProfile = async () => {
            setIsChecking(true)
            setError(null)
            setErrorDetails(null)
            try {
                const response = await apiRequest<MeResponse>(
                    "/me",
                    { method: "GET" },
                    () =>
                        getAccessTokenSilently({
                            authorizationParams: {
                                audience: import.meta.env.VITE_AUTH0_AUDIENCE
                            }
                        })
                )

                if (!response?.data?.university || !response?.data?.course || !response?.data?.year) {
                    setNeedsOnboarding(true)
                    setUniversity(response?.data?.university ?? "")
                    setCourse(response?.data?.course ?? "")
                    setYear(response?.data?.year ? String(response.data.year) : "")
                } else {
                    setNeedsOnboarding(false)
                }
            } catch (err) {
                setNeedsOnboarding(true)
                if (err instanceof ApiError && err.status === 404) {
                    setError(null)
                    setErrorDetails(null)
                } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                    setError("Auth failed. Check Auth0 audience and API URL.")
                    setErrorDetails(formatApiError(err))
                } else {
                    setError("Unable to load your profile.")
                    if (err instanceof ApiError) {
                        setErrorDetails(formatApiError(err))
                    } else {
                        setErrorDetails(formatUnknownError(err))
                    }
                }
            } finally {
                setIsChecking(false)
            }
        }

        void checkProfile()
    }, [getAccessTokenSilently, isAuthenticated])

    useEffect(() => {
        if (!needsOnboarding) return

        const loadCatalog = async () => {
            setIsCatalogLoading(true)
            try {
                const response = await apiRequest<{ data: University[] }>(
                    "/universities",
                    { method: "GET" },
                    () =>
                        getAccessTokenSilently({
                            authorizationParams: {
                                audience: import.meta.env.VITE_AUTH0_AUDIENCE
                            }
                        })
                )
                setCatalog(response.data ?? [])
            } catch (err) {
                setError("Unable to load university catalog.")
                if (err instanceof ApiError) {
                    setErrorDetails(formatApiError(err))
                } else {
                    setErrorDetails(formatUnknownError(err))
                }
            } finally {
                setIsCatalogLoading(false)
            }
        }

        void loadCatalog()
    }, [getAccessTokenSilently, needsOnboarding])

    const universityOptions = useMemo(
        () => catalog.map((entry) => entry.name),
        [catalog]
    )

    const selectedUniversity = useMemo(
        () => catalog.find((entry) => entry.name === university),
        [catalog, university]
    )

    const courseOptions = useMemo(
        () => selectedUniversity?.courses.map((entry) => entry.name) ?? [],
        [selectedUniversity]
    )

    const selectedCourse = useMemo(
        () => selectedUniversity?.courses.find((entry) => entry.name === course),
        [selectedUniversity, course]
    )

    const yearOptions = useMemo(() => {
        const years = new Set<number>()
        selectedCourse?.modules.forEach((module) => years.add(module.year))
        return Array.from(years).sort((a, b) => a - b)
    }, [selectedCourse])

    useEffect(() => {
        if (!selectedUniversity) {
            setCourse("")
            setYear("")
            return
        }
        if (!courseOptions.includes(course)) {
            setCourse("")
        }
    }, [courseOptions, course, selectedUniversity])

    useEffect(() => {
        if (!selectedCourse) {
            setYear("")
            return
        }
        if (yearOptions.length > 0 && !yearOptions.includes(Number(year))) {
            setYear(String(yearOptions[0]))
        }
    }, [selectedCourse, yearOptions, year])

    const handleSubmit = async () => {
        if (!university.trim() || !course.trim() || !year) {
            setError("Please fill in all required fields.")
            return
        }

        setError(null)
        setErrorDetails(null)
        try {
            await apiRequest<MeResponse>(
                "/me",
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        university: university.trim(),
                        course: course.trim(),
                        year: Number(year)
                    })
                },
                () =>
                    getAccessTokenSilently({
                        authorizationParams: {
                            audience: import.meta.env.VITE_AUTH0_AUDIENCE
                        }
                    })
            )
            setNeedsOnboarding(false)
        } catch (err) {
            if (err instanceof ApiError) {
                setError(`Unable to save your profile. (${err.status})`)
                setErrorDetails(formatApiError(err))
            } else {
                setError("Unable to save your profile.")
                setErrorDetails(formatUnknownError(err))
            }
        }
    }

    if (!isAuthenticated) {
        return <>{children}</>
    }

    if (isChecking) {
        return (
            <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
                <Spinner className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!needsOnboarding) {
        return <>{children}</>
    }

    return (
        <div className="h-[100dvh] w-full flex items-center justify-center bg-background px-5">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Finish your profile</CardTitle>
                    <CardDescription>
                        Tell us what you are studying so we can personalize your experience.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="onboarding-university">University</Label>
                        <select
                            id="onboarding-university"
                            value={university}
                            onChange={(event) => setUniversity(event.target.value)}
                            disabled={isCatalogLoading || universityOptions.length === 0}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="" disabled>
                                {isCatalogLoading ? "Loading universities..." : "Select a university"}
                            </option>
                            {universityOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="onboarding-course">Course</Label>
                        <select
                            id="onboarding-course"
                            value={course}
                            onChange={(event) => setCourse(event.target.value)}
                            disabled={!selectedUniversity || courseOptions.length === 0}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="" disabled>
                                {selectedUniversity ? "Select a course" : "Choose a university first"}
                            </option>
                            {courseOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="onboarding-year">Year of study</Label>
                        <select
                            id="onboarding-year"
                            value={year}
                            onChange={(event) => setYear(event.target.value)}
                            disabled={!selectedCourse || yearOptions.length === 0}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="" disabled>
                                {selectedCourse ? "Select a year" : "Choose a course first"}
                            </option>
                            {yearOptions.map((option) => (
                                <option key={option} value={option}>
                                    Year {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    {error && (
                        <div className="space-y-1">
                            <p className="text-sm text-destructive">{error}</p>
                            {errorDetails && (
                                <p className="text-xs text-muted-foreground break-words">
                                    {errorDetails}
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="button" className="w-full" onClick={handleSubmit}>
                        Save details
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
