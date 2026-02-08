import "dotenv/config"

if (typeof (globalThis as { self?: unknown }).self === "undefined") {
    ; (globalThis as { self?: unknown }).self = globalThis
}

if (typeof (globalThis as { navigator?: unknown }).navigator === "undefined") {
    ; (globalThis as { navigator?: { userAgent: string } }).navigator = { userAgent: "node" }
}

if (!process.env.TRANSFORMERS_DISABLE_SHARP) {
    process.env.TRANSFORMERS_DISABLE_SHARP = "1"
}

import "./server"
