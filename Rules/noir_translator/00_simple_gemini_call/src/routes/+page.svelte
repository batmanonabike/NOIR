<script lang="ts">
	import { translateText } from '$lib/gemini';
	import type { TranslateResponse } from '$lib/gemini';

	type Status = 'idle' | 'loading' | 'done' | 'error';

	let inputText = $state(`## Imperiet

Imperiet är ett mörkt och brutalt rike som sträcker sig över tre kontinenter. Dess kejsare, **Malachar den Grymme**, har styrt med järnhand i över fyrtio år.

Städerna är fyllda av *skuggor och hemligheter* — korrupta ämbetsmän, gömda rebeller och farliga kulter lurar bakom varje fasad.

> "I Sandukar överlever man inte genom styrka, utan genom att veta vem man kan köpa."`);
	let result = $state<TranslateResponse | null>(null);
	let status = $state<Status>('idle');
	let errorMessage = $state('');
	let copyLabel = $state('📋 Copy to clipboard');

	async function handleTranslate(): Promise<void> {
		if (!inputText.trim()) return;
		status = 'loading';
		errorMessage = '';
		result = null;

		try {
			result = await translateText(inputText);
			status = 'done';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
			status = 'error';
		}
	}

	async function handleCopy(): Promise<void> {
		if (!result) return;
		await navigator.clipboard.writeText(result.translatedText);
		copyLabel = '✅ Copied!';
		setTimeout(() => {
			copyLabel = '📋 Copy to clipboard';
		}, 2000);
	}

	const totalTokens = $derived(result ? result.inputTokens + result.outputTokens : 0);
</script>

<main>
	<h1>🕵️ Noir RPG Translator</h1>
	<p class="subtitle">Swedish → English · Gemini · Phase 0</p>

	<section class="input-section">
		<label for="swedish-input">Swedish source (GitHub Markdown)</label>
		<textarea
			id="swedish-input"
			bind:value={inputText}
			placeholder="Paste Swedish markdown here…"
			rows={12}
			disabled={status === 'loading'}
		></textarea>
		<button onclick={handleTranslate} disabled={status === 'loading' || !inputText.trim()}>
			{status === 'loading' ? '⏳ Translating…' : '▶ Translate'}
		</button>
	</section>

	{#if status === 'error'}
		<div class="error-box">
			<strong>Error:</strong>
			{errorMessage}
		</div>
	{/if}

	{#if status === 'done' && result}
		<section class="result-section">
			<div class="token-usage">
				📊 Tokens — input: {result.inputTokens} · output: {result.outputTokens} · total: {totalTokens}
			</div>
			<label for="english-output">English translation</label>
			<textarea id="english-output" value={result.translatedText} readonly rows={20}></textarea>
			<button onclick={handleCopy}>{copyLabel}</button>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		background: #111;
		color: #e0d6c8;
		font-family: monospace;
		margin: 0;
		padding: 0;
	}

	main {
		max-width: 860px;
		margin: 40px auto;
		padding: 24px;
	}

	h1 {
		color: #c9a84c;
		font-size: 1.5rem;
		margin-bottom: 4px;
	}

	.subtitle {
		color: #888;
		font-size: 0.85rem;
		margin-bottom: 32px;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 24px;
	}

	label {
		color: #aaa;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	textarea {
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 4px;
		box-sizing: border-box;
		color: #e0d6c8;
		font-family: monospace;
		font-size: 0.9rem;
		padding: 12px;
		resize: vertical;
		width: 100%;
	}

	textarea:focus {
		border-color: #c9a84c;
		outline: none;
	}

	textarea[readonly] {
		background: #141a14;
		border-color: #2a4a2a;
	}

	button {
		align-self: flex-start;
		background: #c9a84c;
		border: none;
		border-radius: 4px;
		color: #111;
		cursor: pointer;
		font-family: monospace;
		font-size: 0.95rem;
		font-weight: bold;
		padding: 10px 22px;
	}

	button:disabled {
		background: #444;
		color: #777;
		cursor: not-allowed;
	}

	button:hover:not(:disabled) {
		background: #e8c96a;
	}

	.error-box {
		background: #2a1414;
		border: 1px solid #6a2a2a;
		border-radius: 4px;
		color: #e88;
		margin-bottom: 24px;
		padding: 12px 16px;
	}

	.token-usage {
		background: #1a1a2a;
		border: 1px solid #2a2a4a;
		border-radius: 4px;
		color: #8888cc;
		font-size: 0.8rem;
		padding: 8px 12px;
	}
</style>
