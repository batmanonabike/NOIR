/**
 * Shared types for Phase 1 — Chunked Batch Translator.
 * Imported by page, storage helpers, and server route.
 * Must NOT import anything from $env.
 */

/** Status of a single chunk translation. */
export type ChunkStatus = 'pending' | 'translating' | 'done' | 'error';

/** Per-chunk progress record stored in localStorage. */
export interface ChunkProgress {
	/** Current translation status. */
	status: ChunkStatus;
	/** Translated English markdown, or null if not yet translated. */
	translation: string | null;
	/** Human-readable error message, or null if no error. */
	error: string | null;
	/** Gemini prompt token count for this chunk. */
	inputTokens: number;
	/** Gemini completion token count for this chunk. */
	outputTokens: number;
}

/** Root progress object persisted to localStorage. */
export interface TranslationProgress {
	/** Schema version — increment if structure changes. */
	version: 1;
	/** Number of source chunks — must match current noir_chunks.json length. */
	chunkCount: number;
	/** ISO timestamp when the first translation run was started. */
	startedAt: string;
	/** ISO timestamp of the most recent localStorage save. */
	updatedAt: string;
	/** One entry per source chunk, index-aligned with the source array. */
	chunks: ChunkProgress[];
}

/** Request body sent to /api/translate */
export interface TranslateRequest {
	/** Raw Swedish markdown text to translate. */
	text: string;
}

/** Success response from /api/translate */
export interface TranslateResponse {
	/** Translated English markdown text. */
	translatedText: string;
	/** Gemini prompt token count. */
	inputTokens: number;
	/** Gemini completion token count. */
	outputTokens: number;
}

/** Error response from /api/translate */
export interface TranslateErrorResponse {
	error: string;
}
