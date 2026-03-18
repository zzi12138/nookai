import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Payload = {
  image?: string;
  theme?: string;
};

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

function buildExplainerPrompt(theme: string) {
  return `
Transform the provided room redesign photo into a clean explainer diagram.

Style direction:
- minimal
- instruction-like
- Apple / IKEA style
- not photorealistic

Strict visual rules:
1) Keep only key upgraded elements visible: lighting, rug, wall art, plants, decor.
2) Simplify the rest of the room into light neutral line-art or faded background.
3) Add clean numbered markers near key points: ① ② ③ ④.
4) Use calm neutral colors and high readability.
5) Keep composition stable and easy to understand in one glance.

Theme context: ${theme}

Output must feel like a visual transformation explanation, not a normal room photo.
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const image = body.image || '';
    const theme = body.theme || '日式原木风';

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY (or GOOGLE_API_KEY)' },
        { status: 500 }
      );
    }

    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
    const prompt = buildExplainerPrompt(theme);
    const base64Image = stripDataUrl(image);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE'],
          },
        }),
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error?.message || result?.error || 'Explainer generation failed' },
        { status: 500 }
      );
    }

    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part: any) => part?.inline_data || part?.inlineData);
    const inline = imagePart?.inline_data || imagePart?.inlineData;
    const mimeType = inline?.mime_type || inline?.mimeType || 'image/png';
    const data = inline?.data;

    if (!data) {
      return NextResponse.json(
        { error: 'No explainer image data returned from Gemini' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      explainerImageUrl: `data:${mimeType};base64,${data}`,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
