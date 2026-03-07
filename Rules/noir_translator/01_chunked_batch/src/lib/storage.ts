/**
 * localStorage persistence helpers for translation progress.
 * Runs only in a browser context.
 */

import type { TranslationProgress } from './types';

const STORAGE_KEY = 'noir-translation-v1';

/** Load persisted progress from localStorage. Returns null if nothing is saved or parse fails. */
export function loadProgress(): TranslationProgress | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as TranslationProgress;
	} catch {
		return null;
	}
}

/** Persist current progress to localStorage. */
export function saveProgress(progress: TranslationProgress): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

/** Remove all persisted progress (used by Reset). */
export function clearProgress(): void {
	localStorage.removeItem(STORAGE_KEY);
}
