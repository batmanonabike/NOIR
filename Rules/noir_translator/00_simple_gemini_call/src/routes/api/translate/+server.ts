import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RequestHandler } from './$types';
import type { TranslateRequest, TranslateResponse } from '$lib/gemini';

const GEMINI_MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = `You are a professional translator specializing in Swedish to English translation of tabletop RPG rulebooks.

Translate the provided Swedish markdown text to English. Rules:
1. Preserve ALL markdown formatting exactly (##, **, <!-- -->, *italics*, tables, etc.)
2. Keep proper nouns unchanged: Sandukar, Imperiet, character names, place names
3. Translate naturally for a native English RPG audience — use genre-appropriate terminology
4. Keep the tone: dark, noir, dystopian
5. Output ONLY the translated markdown — no preamble, no explanation, no markdown code fences`;

export const POST: RequestHandler = async ({ request }) => {
	let body: TranslateRequest;

	try {
		body = (await request.json()) as TranslateRequest;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
		return json({ error: 'Missing or empty "text" field' }, { status: 400 });
	}

	const apiKey = env['GEMINI_API_KEY'];
	if (!apiKey) {
		return json({ error: 'GEMINI_API_KEY is not configured. Copy .env.example to .env.local and set your key.' }, { status: 500 });
	}

	try {
		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({
			model: GEMINI_MODEL,
			systemInstruction: SYSTEM_PROMPT
		});

		const result = await model.generateContent(
			`Translate this Swedish RPG markdown to English:\n\n${body.text}`
		);

		const geminiResponse = result.response;
		const translatedText = geminiResponse.text();
		const usage = geminiResponse.usageMetadata;

		const responseBody: TranslateResponse = {
			translatedText,
			inputTokens: usage?.promptTokenCount ?? 0,
			outputTokens: usage?.candidatesTokenCount ?? 0
		};

		return json(responseBody);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown Gemini API error';
		return json({ error: message }, { status: 502 });
	}
};
