import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { PageServerLoad } from './$types';

/**
 * Server-side load: read noir_chunks.json from TranslationTempFiles/ and pass to the page.
 * process.cwd() = noir_translator/01_chunked_batch when running `npm run dev`.
 * Two levels up reaches the workspace root (Rules/), then into TranslationTempFiles/.
 */
export const load: PageServerLoad = () => {
	const chunksPath = resolve(process.cwd(), '../../TranslationTempFiles/noir_chunks.json');
	const chunks = JSON.parse(readFileSync(chunksPath, 'utf-8')) as string[];
	return { chunks };
};
