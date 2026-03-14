import { NextResponse } from "next/server"

export const runtime = "nodejs"

const LAS_DEFAULT_BASE_URL = "https://operator.las.cn-beijing.volces.com"
const LAS_DEFAULT_PATH = "/api/v1/images/generations"
const ARK_DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com"
const ARK_DEFAULT_PATH = "/api/v3/images/generations"
const DEFAULT_MODEL = "doubao-seedream-4-5-251128"

type SeedreamResponse = {
  data?: Array<{ url?: string; b64_json?: string; size?: string }>
  code?: number
  message?: string
  error?: { message?: string } | string
}

function buildEndpoint(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/$/, "")
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${base}${suffix}`
}

export async function POST(req: Request) {
  try {
    const { image, theme } = await req.json()

    if (!image || !theme) {
      return NextResponse.json(
        { error: "Missing image or theme" },
        { status: 400 }
      )
    }

    const arkKey = process.env.ARK_API_KEY
    const lasKey = process.env.VOLCENGINE_API_KEY || process.env.LAS_API_KEY
    const provider =
      process.env.SEEDREAM_PROVIDER ||
      (arkKey ? "ark" : "las")

    if (provider === "ark" && !arkKey) {
      return NextResponse.json(
        { error: "Missing ARK_API_KEY" },
        { status: 500 }
      )
    }

    if (provider !== "ark" && !lasKey) {
      return NextResponse.json(
        { error: "Missing VOLCENGINE_API_KEY (or LAS_API_KEY)" },
        { status: 500 }
      )
    }

    const baseUrl =
      provider === "ark"
        ? process.env.ARK_BASE_URL || ARK_DEFAULT_BASE_URL
        : process.env.VOLCENGINE_BASE_URL || LAS_DEFAULT_BASE_URL

    const path =
      provider === "ark"
        ? process.env.ARK_IMAGE_PATH || ARK_DEFAULT_PATH
        : process.env.VOLCENGINE_IMAGE_PATH || LAS_DEFAULT_PATH

    const endpoint = buildEndpoint(baseUrl, path)
    const size =
      process.env.SEEDREAM_SIZE ||
      (provider === "ark" ? "2K" : "2048x2048")

    const imagePayload =
      provider === "ark" ? `data:image/png;base64,${image}` : image
    const responseFormat = provider === "ark" ? "b64_json" : "url"

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider === "ark" ? arkKey : lasKey}`
      },
      body: JSON.stringify({
        model: process.env.SEEDREAM_MODEL || DEFAULT_MODEL,
        prompt: `Photorealistic interior refresh, ${theme} style. Preserve original room layout, geometry, camera angle, walls, floor, ceiling, windows, and built-in fixtures. Only add or adjust soft furnishings, lighting, textiles, decor, plants, and small movable items to create a cozy, low-budget rental-friendly atmosphere. Keep composition unchanged and avoid structural modifications.`,
        image: imagePayload,
        size,
        response_format: responseFormat,
        watermark: false
      })
    })

    const rawText = await response.text()
    let result: SeedreamResponse = {}

    if (rawText) {
      try {
        result = JSON.parse(rawText) as SeedreamResponse
      } catch {
        result = { error: rawText }
      }
    }

    if (!response.ok) {
      const message =
        typeof result.error === "string"
          ? result.error
          : result.error?.message || result.message
      const fallback = response.status
        ? `Generation failed (HTTP ${response.status})`
        : "Generation failed"
      return NextResponse.json(
        {
          error: message || fallback,
          status: response.status,
          provider
        },
        { status: 500 }
      )
    }

    const url = result.data?.[0]?.url
    const b64 = result.data?.[0]?.b64_json
    const imageUrl = url || (b64 ? `data:image/jpeg;base64,${b64}` : undefined)

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image returned", provider },
        { status: 502 }
      )
    }

    return NextResponse.json({ imageUrl, provider })
  } catch (error) {
    console.error("Seedream generate error:", error)
    const cause =
      error && typeof error === "object" && "cause" in error
        ? String((error as { cause?: unknown }).cause)
        : undefined
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Server error",
        ...(cause ? { cause } : {})
      },
      { status: 500 }
    )
  }
}
