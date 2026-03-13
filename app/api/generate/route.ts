import { NextResponse } from "next/server"

export const runtime = "nodejs"

const OPENAI_IMAGES_EDIT_URL = "https://api.openai.com/v1/images/edits"

type OpenAIImageResult = {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { message?: string } | string
}

function detectImageType(base64: string) {
  if (base64.startsWith("/9j/")) {
    return { mime: "image/jpeg", ext: "jpg" }
  }
  if (base64.startsWith("iVBORw0KGgo")) {
    return { mime: "image/png", ext: "png" }
  }
  if (base64.startsWith("UklGR")) {
    return { mime: "image/webp", ext: "webp" }
  }
  if (base64.startsWith("R0lGOD")) {
    return { mime: "image/gif", ext: "gif" }
  }
  return { mime: "image/png", ext: "png" }
}

export async function POST(req: Request) {
  try {
    const { image, theme } = await req.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      )
    }

    if (!image || !theme) {
      return NextResponse.json(
        { error: "Missing image or theme" },
        { status: 400 }
      )
    }

    const { mime, ext } = detectImageType(image)
    const buffer = Buffer.from(image, "base64")
    const file = new Blob([buffer], { type: mime })

    const form = new FormData()
    form.append("model", "gpt-image-1")
    form.append(
      "prompt",
      `A masterpiece, 8k uhd, highly detailed, photorealistic architectural photography of a room, ${theme} interior design style, cozy atmosphere, professional rendering`
    )
    form.append("image", file, `input.${ext}`)
    form.append("output_format", "png")

    const response = await fetch(OPENAI_IMAGES_EDIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    })

    const rawText = await response.text()
    let result: OpenAIImageResult = {}

    if (rawText) {
      try {
        result = JSON.parse(rawText) as OpenAIImageResult
      } catch {
        result = { error: rawText }
      }
    }

    if (!response.ok) {
      const message =
        typeof result.error === "string"
          ? result.error
          : result.error?.message
      return NextResponse.json(
        { error: message || "Generation failed" },
        { status: 500 }
      )
    }

    const b64 = result.data?.[0]?.b64_json
    const url = result.data?.[0]?.url
    const imageUrl = b64 ? `data:image/png;base64,${b64}` : url

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image returned" },
        { status: 502 }
      )
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("OpenAI image edit error:", error)
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
