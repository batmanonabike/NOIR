/**
 * Client-side helper to call the internal /api/translate endpoint.
 * The actual Gemini API key never leaves the server.
 */

import type { TranslateRequest, TranslateResponse, TranslateErrorResponse } from './types';

/**
 * Translate a Swedish markdown string to English via the server-side proxy.
 * @throws Error with a human-readable message on HTTP or API failure.
 */
export async function translateText(swedishText: string): Promise<TranslateResponse> {
	const body: TranslateRequest = { text: swedishText };

	const response = await fetch('/api/translate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const err = (await response.json()) as TranslateErrorResponse;
		throw new Error(err.error ?? `HTTP ${response.status}`);
	}

	return response.json() as Promise<TranslateResponse>;
}
