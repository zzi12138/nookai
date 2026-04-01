export async function readMoonshotResponse(response: Response) {
  const raw = await response.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  return { raw, json };
}

export function moonshotErrorMessage(json: any, raw: string, fallback: string) {
  return (
    json?.error?.message ||
    json?.error ||
    raw?.slice(0, 300) ||
    fallback
  );
}

export function moonshotMessageText(json: any) {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: { type?: string; text?: string }) => (part?.type === 'text' ? part.text || '' : ''))
      .join('\n')
      .trim();
  }
  return '';
}

export function stripCodeFence(text: string) {
  let output = text.trim();
  if (output.startsWith('```')) {
    output = output.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return output.trim();
}

function extractFirstJSONObjectText(input: string): string | null {
  const text = stripCodeFence(input);
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

export function parseFirstJSONObject<T>(input: string): T | null {
  const direct = stripCodeFence(input);
  try {
    return JSON.parse(direct) as T;
  } catch {
    // continue
  }

  const extracted = extractFirstJSONObjectText(input);
  if (!extracted) return null;
  try {
    return JSON.parse(extracted) as T;
  } catch {
    return null;
  }
}
