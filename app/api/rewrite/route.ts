import { NextRequest, NextResponse } from 'next/server';

const REWRITE_PROMPT = (text: string) => `You are a spelling and grammar corrector for food safety observation reports.

Rewrite the following text in 3 ways. Rules:
- Fix ALL spelling and grammar errors
- Do NOT add any new sentences, details, recommendations, or extra information
- Do NOT add conclusions like "this poses a risk" or "corrective action needed"
- Keep the SAME number of sentences as the original — just correct and rephrase them
- Keep it simple and clear

Return EXACTLY this JSON (no markdown, no code blocks):
{"options":[{"label":"Corrected","text":"..."},{"label":"Professional","text":"..."},{"label":"Concise","text":"..."}]}

The 3 styles:
1. "Corrected" — same text with spelling and grammar fixed, nothing else changed
2. "Professional" — same meaning rewritten in formal professional language, no extra sentences added
3. "Concise" — same meaning in fewer words, tight and direct

Original text:
${text}`;

function parseAIResponse(raw: string | undefined | null): any[] | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  cleaned = cleaned.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*"options"[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.options && Array.isArray(parsed.options) && parsed.options.length > 0) {
      return parsed.options;
    }
  } catch {}
  return null;
}

async function tryFreeLLM(text: string): Promise<any[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch('https://api.llm7.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer unused',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [{ role: 'user', content: REWRITE_PROMPT(text) }],
        temperature: 0.7,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return parseAIResponse(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryGemini(text: string): Promise<any[] | null> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: REWRITE_PROMPT(text),
    });
    return parseAIResponse(response?.text);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const freeLLMResult = await tryFreeLLM(text);
    if (freeLLMResult) {
      return NextResponse.json({ options: freeLLMResult });
    }

    const geminiResult = await tryGemini(text);
    if (geminiResult) {
      return NextResponse.json({ options: geminiResult });
    }

    return NextResponse.json({ error: 'AI_UNAVAILABLE' }, { status: 503 });
  } catch (error: any) {
    console.error('Rewrite API error:', error);
    return NextResponse.json({ error: error.message || 'Rewrite failed' }, { status: 500 });
  }
}
