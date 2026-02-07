export class ApiError extends Error {
    status: number
    body?: unknown

    constructor(message: string, status: number, body?: unknown) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.body = body
    }
}

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"

type TokenGetter = () => Promise<string>

export async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
    getToken: TokenGetter
): Promise<T> {
    const token = await getToken()
    const headers = new Headers(options.headers)

    if (!headers.has("Content-Type") && options.body) {
        headers.set("Content-Type", "application/json")
    }
    headers.set("Authorization", `Bearer ${token}`)

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
    })

    if (response.ok) {
        if (response.status === 204) {
            return undefined as T
        }
        return (await response.json()) as T
    }

    let errorBody: unknown = undefined
    try {
        errorBody = await response.json()
    } catch {
        errorBody = await response.text()
    }

    const location = response.headers.get("location")
    const meta = {
        url: response.url,
        location
    }

    if (typeof errorBody === "object" && errorBody !== null) {
        errorBody = { ...errorBody, meta }
    } else if (typeof errorBody === "string" && errorBody.length > 0) {
        errorBody = { message: errorBody, meta }
    } else {
        errorBody = { meta }
    }

    throw new ApiError("Request failed", response.status, errorBody)
}
