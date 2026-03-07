/**
 * Shared types for the Gemini translation API boundary.
 * This file is imported by BOTH the client (page) and server (API route).
 * It must NOT import anything from $env — that is server-only.
 */

export interface TranslateRequest {
	/** Raw Swedish markdown text to translate. */
	text: string;
}

export interface TranslateResponse {
	/** Translated English markdown text. */
	translatedText: string;
	/** Number of input (prompt) tokens consumed. */
	inputTokens: number;
	/** Number of output (completion) tokens consumed. */
	outputTokens: number;
}

export interface TranslateErrorResponse {
	error: string;
}

/**
 * Calls the internal /api/translate endpoint.
 * The actual Gemini API key is never sent to the client.
 *
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
