import { NextResponse } from "next/server"

export const runtime = "nodejs"

const DEFAULT_BASE_URL = "https://operator.las.cn-beijing.volces.com"
const DEFAULT_PATH = "/api/v1/online/images/generations"
const DEFAULT_MODEL = "doubao-seedream-4-0-250828"

type SeedreamResponse = {
  data?: Array<{ url?: string; b64_json?: string; size?: string }>
  code?: number
  message?: string
  error?: { message?: string } | string
}

export async function POST(req: Request) {
  try {
    const { image, theme } = await req.json()

    const apiKey = process.env.VOLCENGINE_API_KEY || process.env.LAS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing VOLCENGINE_API_KEY (or LAS_API_KEY)" },
        { status: 500 }
      )
    }

    if (!image || !theme) {
      return NextResponse.json(
        { error: "Missing image or theme" },
        { status: 400 }
      )
    }

    const baseUrl = (process.env.VOLCENGINE_BASE_URL || DEFAULT_BASE_URL).replace(
      /\/$/,
      ""
    )
    const path = process.env.VOLCENGINE_IMAGE_PATH || DEFAULT_PATH
    const endpoint = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.SEEDREAM_MODEL || DEFAULT_MODEL,
        prompt: `A masterpiece, 8k uhd, highly detailed, photorealistic architectural photography of a room, ${theme} interior design style, cozy atmosphere, professional rendering`,
        image,
        size: "2048x2048",
        response_format: "url",
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
      return NextResponse.json(
        { error: message || "Generation failed" },
        { status: 500 }
      )
    }

    const url = result.data?.[0]?.url
    const b64 = result.data?.[0]?.b64_json
    const imageUrl = url || (b64 ? `data:image/jpeg;base64,${b64}` : undefined)

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image returned" },
        { status: 502 }
      )
    }

    return NextResponse.json({ imageUrl })
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
