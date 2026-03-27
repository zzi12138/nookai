import { ITEMS_BOARD_CONFIG, type BoardCell } from '../../lib/itemsBoard';
import type { NormalizedItem } from './board-state';

export function buildItemsBoardPrompt(theme: string, items: NormalizedItem[]) {
  const assignedOrder = items
    .filter((item) => item.boardCell)
    .sort((a, b) => (a.boardCell?.index || 99) - (b.boardCell?.index || 99))
    .map((item, index) => `${index + 1}. ${item.name}`)
    .join('、');

  return `
Use the provided generated room image as the ONLY visual reference.
Generate a single hidden extraction image for deterministic thumbnail crops.

GOAL:
Create one clean white-background composite image containing isolated purchasable objects from the room.
This image is for internal cropping only, not for user display.

STRICT LAYOUT:
1) Final canvas must be exactly ${ITEMS_BOARD_CONFIG.width}x${ITEMS_BOARD_CONFIG.height} pixels.
2) Use an invisible 4 columns x 3 rows placement map with 12 equal regions.
3) Do NOT draw the map. Do NOT render region borders, frames, dividers, cards, boxes, tiles, or outlines.
4) Put exactly one complete object in each region.
5) Every object must be centered in its region with generous empty margin around it.
6) Each object should occupy only about 40% to 50% of its region, never touching edges.
7) No overlap between objects.
8) No room background, no architecture, no furniture scene, no walls, no floor, no windows.

OBJECT RULES:
1) Preserve the same color, material, and overall styling seen in the generated room.
2) Show complete recognizable objects, never texture fragments or cropped corners.
3) Prioritize visible purchasable items only: lamps, rugs, bedding, pillows, throws, decor objects, framed art, plants, accessories.
4) Forbidden: wall paint, wall color, ceiling, flooring material, doors, windows, architectural elements.

ABSOLUTELY FORBIDDEN:
- text
- letters
- numbers
- labels
- arrows
- callouts
- guide lines
- captions
- logos
- watermarks
- UI overlays
- borders
- frames
- boxes
- dividers
- poster layouts
- magazine layouts
- infographic styling

VISUAL STYLE:
- high-resolution e-commerce product photography
- warm cream or very light neutral background
- the entire background should carry a subtle tone-on-tone square / woven texture, low contrast and semi-transparent in feel
- the texture must be continuous across the whole canvas, not separated into cells
- the texture must never look like a frame, border, divider, or panel line
- soft studio lighting
- realistic materials
- clean, sharp edges
- strong object separation
- no decorative composition
- no clutter around objects

PLACE OBJECTS in exact reading order from top-left to bottom-right:
${assignedOrder || 'Use visible purchasable objects from the generated room and place them deterministically.'}

  Theme context: ${theme || '日式原木风'}
`.trim();
}

export function getBoardValidationPrompt(theme: string) {
  return `
You are validating an internal extracted-items board image for a shopping guide.
Inspect the image and return strict JSON only.

Validation goals:
1) detect whether there are visible text or number regions
2) detect whether there are visible frames, boxes, dividers, or hard grid-like lines
3) estimate whether the background is mostly warm cream or very light neutral
4) provide rough bounding regions for text and frame artifacts when visible

Rules:
- text includes any letters, Chinese text, numbers, labels, captions, or watermarks
- frame artifacts include borders, cell outlines, dividers, panel lines, box edges, hard grid lines
- do NOT treat subtle tone-on-tone woven or square background texture as a frame artifact
- a soft repeating background pattern is allowed if it does not look like a border or panel
- only mark regions when reasonably visible
- coordinates must be percentages from 0 to 100
- return at most 8 text regions and 8 frame regions

Theme context: ${theme || '日式原木风'}

Return JSON in this exact structure:
{
  "hasText": true,
  "hasGridOrFrames": true,
  "whiteBackgroundScore": 0.72,
  "backgroundMostlyWhite": true,
  "textRegions": [
    { "left": 10, "top": 10, "width": 20, "height": 8, "confidence": 0.81, "label": "text" }
  ],
  "frameRegions": [
    { "left": 0, "top": 0, "width": 100, "height": 100, "confidence": 0.78, "label": "frame" }
  ],
  "reasons": ["text detected", "frame lines detected"]
}
`.trim();
}

export function getBoardCleanupPrompt(theme: string) {
  return `
Use the provided extracted-items board as the exact base image.

Task:
Remove only unwanted artifacts from the board:
- any text
- any letters
- any numbers
- any labels
- any captions
- any arrows
- any guide lines
- any borders
- any frames
- any boxes
- any dividers
- any faint UI chrome
- any pale slot edges
- any rectangle outlines around objects
- any residual grid-like separators

Preserve strictly:
- same canvas size
- same background whiteness
- same object count
- same object order
- same object placement
- same object scale
- same object colors and materials

Do not redesign the objects.
Do not add new objects.
Do not remove valid objects.
Do not move objects.

Theme context: ${theme || '日式原木风'}
`.trim();
}

export type BoardPromptInputs = {
  theme: string;
  items: NormalizedItem[];
  boardCell?: BoardCell;
};
