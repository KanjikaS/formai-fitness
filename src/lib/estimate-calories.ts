import { createServerFn } from '@tanstack/react-start';

export type CalorieEstimate = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  notes: string;
};

const BASE_URL = process.env['LITELLM_BASE_URL'] ?? 'http://3.85.113.204:4044/v1';
const API_KEY = process.env['LITELLM_API_KEY'] ?? 'sk-demo';
const MODEL = process.env['VISION_MODEL'] ?? 'global.moonshotai.kimi-k3';

const PROMPT = [
  'You are a nutrition assistant inside a wellness app. Estimate the calories in this meal photo.',
  'Respond with ONLY compact JSON on one line, no markdown fences, in exactly this shape:',
'{"name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "fibre": number, "notes": string}.',
  '"name" is a short meal name (max 60 chars). "calories" is a realistic integer kcal estimate for',
  'the visible portion. "protein", "carbs", "fat" and "fibre" are your best macro estimates in integer grams.',
  '"notes" is one sentence (max 120 chars) naming the main items you saw and',
  'flagging that this is a rough visual estimate, not dietary advice.',
  'If the photo is not food or is unclear, still respond with your best guess and set "notes" to',
  'explain the uncertainty.',
].join(' ');

function clampGrams(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.round(n), 0), 1000);
}

function extractJson(text: string): CalorieEstimate {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model returned no JSON.');
  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<CalorieEstimate>;
  const calories = Number(parsed.calories);
  if (!parsed.name || !Number.isFinite(calories)) throw new Error('Model returned an unexpected shape.');
  return {
    name: String(parsed.name).slice(0, 80),
    calories: Math.min(Math.max(Math.round(calories), 0), 10000),
    protein: clampGrams(parsed.protein),
    carbs: clampGrams(parsed.carbs),
    fat: clampGrams(parsed.fat),
    fibre: clampGrams(parsed.fibre),
    notes: String(parsed.notes ?? 'Rough visual estimate, not dietary advice.').slice(0, 160),
  };
}

export const estimateCalories = createServerFn({ method: 'POST' })
  .inputValidator((data: { imageBase64: string; mimeType: string }) => {
    if (!data || typeof data.imageBase64 !== 'string' || !data.imageBase64) {
      throw new Error('Missing image data.');
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(data.mimeType)) {
      throw new Error('Unsupported image type.');
    }
    // ~10 MB of binary is ~13.3 MB base64
    if (data.imageBase64.length > 14 * 1024 * 1024) {
      throw new Error('Image is too large.');
    }
    return data;
  })
  .handler(async ({ data }): Promise<CalorieEstimate> => {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        response_format: {
          "type": "json_object"
        },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vision request failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content ?? '';
    return extractJson(text);
  });
