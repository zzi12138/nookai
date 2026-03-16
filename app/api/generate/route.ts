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
      typeof promptStrength === "number" ? promptStrength : 0.35
    const strength = Math.min(0.4, Math.max(0.25, strengthRaw))

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
    const model = process.env.SEEDREAM_MODEL || DEFAULT_MODEL
    const themeDetails: Record<string, string> = {
      日式原木风:
        "Japanese natural wood style. Calm Japanese-inspired interior with natural wood tones, minimal decoration, and a peaceful atmosphere. Color palette: light wood, beige, cream, warm neutrals. Decor: linen curtains, beige cushions, wooden trays, ceramic vases, simple wooden decor, paper lampshades. Plants: monstera, ficus, olive tree. Lighting: soft warm lighting with a relaxing and natural feeling. Mood: calm, minimal, natural, warm, peaceful.",
      奶油温柔风:
        "soft creamy minimal style. Soft creamy interior with warm neutral tones and cozy textures; comfortable, gentle, slightly elegant. Color palette: cream, soft beige, warm white, light neutral tones. Decor: boucle cushions, fluffy pillows, soft blankets, round mirrors, neutral art prints. Plants: pampas grass, small decorative plants. Lighting: warm ambient lighting from table lamps and soft lampshades. Mood: soft, cozy, warm, elegant, gentle.",
      现代极简风:
        "modern minimalist style. Clean modern minimalist interior with simple lines, neutral colors, uncluttered surfaces. Color palette: black, white, gray, neutral tones. Decor: minimal wall art, monochrome cushions, geometric rugs, simple desk accessories. Lighting: modern floor lamps or minimal table lamps. Decor remains minimal and organized. Mood: clean, modern, structured, balanced, minimal.",
      文艺复古风:
        "vintage artistic style. Cozy vintage-inspired interior with artistic details and warm lighting; creative, expressive, slightly nostalgic. Color palette: warm browns, muted colors, soft vintage tones. Decor: vintage posters, stacked books, retro table lamps, textured blankets, artistic objects. Optional props: film camera, record player, classic books. Lighting: warm yellow lighting creating a cozy artistic mood. Mood: artistic, nostalgic, warm, creative, cozy.",
      绿植自然风:
        "urban nature style. Nature-inspired interior with greenery, fresh textures, natural materials. Color palette: natural greens, beige, light wood, neutral colors. Decor: woven baskets, cotton textiles, natural fiber rugs, botanical prints. Plants: multiple indoor plants such as monstera, snake plant, ficus, and pothos. Lighting: bright natural light with a fresh atmosphere. Mood: fresh, natural, airy, relaxing, organic."
    }
    const themeStyle = themeDetails[theme] || theme

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider === "ark" ? arkKey : lasKey}`
      },
      body: JSON.stringify({
        model,
        prompt:
          "Perform a realistic interior refresh of a rental apartment based on the provided photo. " +
          "Step 1 — Declutter the room first: Remove all clutter, trash, messy belongings, and random small objects. The room should appear clean, tidy, and organized before adding any decorations. " +
          `Step 2 — Apply a soft furnishing makeover in ${themeStyle}. ` +
          "Important constraints (must follow strictly): " +
          "DO NOT repaint or modify the walls. Wall color and material must remain exactly the same. " +
          "DO NOT replace or modify the floor. " +
          "DO NOT change the ceiling. " +
          "DO NOT modify doors or windows. " +
          "DO NOT change built-in fixtures or architectural structures. " +
          "DO NOT move large furniture or change the layout. " +
          "Only removable decorations and small movable objects are allowed. " +
          "Allowed elements include: textiles, lamps, plants, small decor objects, books, removable wall art, posters, rugs, blankets, pillows. " +
          "Lighting must look natural and physically realistic. " +
          "The final image must keep the same camera angle, perspective, composition, and geometry as the original photo. " +
          "The result should look like the same room after decluttering and soft decoration only. " +
          "No cropping, no zooming, no perspective shift, no camera move, no lens change. " +
          "same room, same architecture, same perspective, only decluttered and softly decorated.",
        negative_prompt:
          "changed room structure, moved furniture, altered layout, rearranged furniture, " +
          "camera moved, perspective shift, different camera angle, zoomed in, zoomed out, cropped, " +
          "added windows, missing walls, structural modifications, new room, different room, " +
          "ugly, blurry, deformed, distorted, chaotic layout, messy, mutated, low resolution, " +
          "bad proportions, unnatural lighting.",
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
