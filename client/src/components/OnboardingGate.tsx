import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
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

const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6]

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

    const [university, setUniversity] = useState("")
    const [course, setCourse] = useState("")
    const [year, setYear] = useState(String(YEAR_OPTIONS[0]))

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
                    setYear(response?.data?.year ? String(response.data.year) : String(YEAR_OPTIONS[0]))
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
                        <Input
                            id="onboarding-university"
                            value={university}
                            onChange={(event) => setUniversity(event.target.value)}
                            placeholder="Your university"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="onboarding-course">Course</Label>
                        <Input
                            id="onboarding-course"
                            value={course}
                            onChange={(event) => setCourse(event.target.value)}
                            placeholder="Your course"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="onboarding-year">Year of study</Label>
                        <select
                            id="onboarding-year"
                            value={year}
                            onChange={(event) => setYear(event.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {YEAR_OPTIONS.map((option) => (
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
