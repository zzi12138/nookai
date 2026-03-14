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
    const { image, theme, promptStrength } = await req.json()

    if (!image || !theme) {
      return NextResponse.json(
        { error: "Missing image or theme" },
        { status: 400 }
      )
    }
    const strengthRaw =
      typeof promptStrength === "number" ? promptStrength : 0.5
    const strength = Math.min(0.55, Math.max(0.45, strengthRaw))

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
    const responseFormat = "url"
    const themeDetails: Record<string, string> = {
      日式原木风:
        "light oak wood grain, low-profile furniture, shoji-inspired textures, warm ambient glow, linen textiles",
      法式复古:
        "ornate molding details, brass accents, vintage art frames, herringbone textures, soft warm lighting",
      极简奶油:
        "creamy monochrome palette, soft rounded edges, minimal decor, matte textures, diffused lighting",
      奶油原木:
        "buttery neutral palette, natural oak wood, boucle fabrics, cozy layered textiles, warm lamps",
      北欧清新:
        "scandinavian light wood, crisp whites, muted sage accents, clean lines, airy daylight",
      侘寂风:
        "wabi-sabi textures, raw plaster walls, earthy neutrals, ceramic decor, soft indirect lighting"
    }
    const themeStr = themeDetails[theme] || theme

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider === "ark" ? arkKey : lasKey}`
      },
      body: JSON.stringify({
        model: process.env.SEEDREAM_MODEL || DEFAULT_MODEL,
        prompt:
          `A photorealistic interior design makeover, ${themeStr} style. ` +
          "STRICTLY KEEP the original room structure and furniture layout. " +
          "ONLY update soft furnishings, rugs, bedding, lighting, and wall textures. " +
          "Masterpiece, 8k uhd, architectural photography, cinematic lighting, cozy atmosphere, highly detailed textures.",
        negative_prompt:
          "changed room structure, moved furniture, altered layout, added windows, missing walls, " +
          "structural modifications, ugly, blurry, deformed, distorted, chaotic layout, " +
          "messy, mutated, low resolution, bad proportions, unnatural lighting.",
        prompt_strength: strength,
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
