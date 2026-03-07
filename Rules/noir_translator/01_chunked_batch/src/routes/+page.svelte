<script lang="ts">
	import type { PageData } from './$types';
	import type { ChunkProgress, TranslationProgress } from '$lib/types';
	import { loadProgress, saveProgress, clearProgress } from '$lib/storage';
	import { translateText } from '$lib/gemini';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	// ── Job state ──────────────────────────────────────────────────────────────
	type JobStatus = 'idle' | 'running' | 'paused' | 'done';

	let jobStatus = $state<JobStatus>('idle');
	let progress = $state<ChunkProgress[]>([]);
	let selectedIndex = $state<number | null>(null);
	let shouldPause = $state(false);
	let startedAt = $state('');

	// ── Derived stats ──────────────────────────────────────────────────────────
	let doneCount = $derived(progress.filter((p) => p.status === 'done').length);
	let errorCount = $derived(progress.filter((p) => p.status === 'error').length);
	let totalInputTokens = $derived(progress.reduce((sum, p) => sum + p.inputTokens, 0));
	let totalOutputTokens = $derived(progress.reduce((sum, p) => sum + p.outputTokens, 0));
	let progressPct = $derived(
		data.chunks.length > 0 ? Math.round((doneCount / data.chunks.length) * 100) : 0
	);

	// ── Initialise on mount: restore from localStorage or start fresh ──────────
	onMount(() => {
		const saved = loadProgress();
		if (saved && saved.version === 1 && saved.chunkCount === data.chunks.length) {
			// Restore saved state; reset any 'translating' chunks that were interrupted
			progress = saved.chunks.map((p) =>
				p.status === 'translating' ? { ...p, status: 'pending', error: null } : p
			);
			startedAt = saved.startedAt;
			jobStatus = progress.every((p) => p.status === 'done') ? 'done' : 'paused';
		} else {
			initProgress();
		}
	});

	// ── Helpers ────────────────────────────────────────────────────────────────

	function initProgress(): void {
		progress = data.chunks.map(() => ({
			status: 'pending',
			translation: null,
			error: null,
			inputTokens: 0,
			outputTokens: 0
		}));
		startedAt = new Date().toISOString();
		jobStatus = 'idle';
	}

	function persistProgress(): void {
		const state: TranslationProgress = {
			version: 1,
			chunkCount: data.chunks.length,
			startedAt,
			updatedAt: new Date().toISOString(),
			chunks: progress
		};
		saveProgress(state);
	}

	/** Extract a short display label from the first non-empty line of a chunk. */
	function chunkLabel(content: string): string {
		const firstLine = content
			.split('\n')
			.find((l) => l.trim().length > 0)
			?.trim() ?? '';
		return firstLine.length > 70 ? firstLine.slice(0, 70) + '…' : firstLine;
	}

	// ── Job control ────────────────────────────────────────────────────────────

	async function startOrResume(): Promise<void> {
		shouldPause = false;
		jobStatus = 'running';
		await runQueue();
	}

	function pause(): void {
		shouldPause = true;
	}

	function reset(): void {
		if (!confirm('Clear all translation progress? This cannot be undone.')) return;
		clearProgress();
		initProgress();
	}

	function downloadResult(): void {
		const merged = progress
			.map((p, i) => p.translation ?? `<!-- UNTRANSLATED CHUNK ${i} -->\n${data.chunks[i] ?? ''}`)
			.join('\n\n');

		const blob = new Blob([merged], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'Noir_English.md';
		a.click();
		URL.revokeObjectURL(url);
	}

	// ── Translation queue ──────────────────────────────────────────────────────

	async function runQueue(): Promise<void> {
		for (let i = 0; i < data.chunks.length; i++) {
			if (shouldPause) {
				jobStatus = 'paused';
				return;
			}
			if (progress[i]?.status === 'done') continue;

			await translateChunk(i);
			persistProgress();
		}

		jobStatus = progress.every((p) => p.status === 'done') ? 'done' : 'paused';
	}

	async function translateChunk(i: number): Promise<void> {
		const chunk = data.chunks[i];
		if (chunk === undefined) return;

		progress[i] = { status: 'translating', translation: null, error: null, inputTokens: 0, outputTokens: 0 };

		try {
			const result = await translateText(chunk);
			progress[i] = {
				status: 'done',
				translation: result.translatedText,
				error: null,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			progress[i] = { status: 'error', translation: null, error: msg, inputTokens: 0, outputTokens: 0 };
		}
	}

	async function retryChunk(i: number): Promise<void> {
		await translateChunk(i);
		persistProgress();
	}

	// ── Detail panel ───────────────────────────────────────────────────────────

	function selectChunk(i: number): void {
		selectedIndex = selectedIndex === i ? null : i;
	}

	function closeDetail(): void {
		selectedIndex = null;
	}

	// ── Status badge helpers ───────────────────────────────────────────────────

	function statusIcon(status: ChunkProgress['status']): string {
		switch (status) {
			case 'done': return '✅';
			case 'translating': return '🔄';
			case 'error': return '❌';
			default: return '⏳';
		}
	}

	function statusClass(status: ChunkProgress['status']): string {
		switch (status) {
			case 'done': return 'done';
			case 'translating': return 'translating';
			case 'error': return 'error';
			default: return 'pending';
		}
	}
</script>

<!-- ── Layout ─────────────────────────────────────────────────────────────── -->
<div class="app">

	<!-- Header / stats bar -->
	<header>
		<h1>Noir RPG — Batch Translator</h1>
		<div class="stats">
			<span class="stat done-stat">✅ {doneCount} / {data.chunks.length}</span>
			{#if errorCount > 0}
				<span class="stat error-stat">❌ {errorCount} errors</span>
			{/if}
			<span class="stat token-stat">🪙 {(totalInputTokens + totalOutputTokens).toLocaleString()} tokens</span>
			<span class="stat token-stat">↑{totalInputTokens.toLocaleString()} ↓{totalOutputTokens.toLocaleString()}</span>
		</div>
	</header>

	<!-- Progress bar -->
	<div class="progress-bar-container" title="{progressPct}% complete">
		<div class="progress-bar" style="width: {progressPct}%"></div>
		<span class="progress-label">{progressPct}%</span>
	</div>

	<!-- Controls -->
	<div class="controls">
		{#if jobStatus === 'idle'}
			<button class="btn primary" onclick={startOrResume}>▶ Start Translation</button>
		{:else if jobStatus === 'running'}
			<button class="btn warning" onclick={pause}>⏸ Pause</button>
		{:else if jobStatus === 'paused'}
			<button class="btn primary" onclick={startOrResume}>▶ Resume</button>
		{:else if jobStatus === 'done'}
			<button class="btn success" onclick={downloadResult}>⬇ Download Result</button>
		{/if}

		{#if jobStatus !== 'idle'}
			<button class="btn secondary" onclick={downloadResult} disabled={doneCount === 0}>
				⬇ Download Partial
			</button>
		{/if}

		<button class="btn danger" onclick={reset}>🔄 Reset</button>

		<span class="job-status-label">
			{#if jobStatus === 'running'}🔄 Translating…{/if}
			{#if jobStatus === 'paused'}⏸ Paused{/if}
			{#if jobStatus === 'done'}✅ Complete{/if}
		</span>
	</div>

	<!-- Main content area: chunk list + detail panel -->
	<div class="content">

		<!-- Chunk list -->
		<div class="chunk-list">
			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Source preview</th>
						<th>Status</th>
						<th>Tokens</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each data.chunks as chunk, i}
						{@const row = progress[i]}
						<tr
							class="chunk-row {row ? statusClass(row.status) : 'pending'} {selectedIndex === i ? 'selected' : ''}"
							onclick={() => selectChunk(i)}
						>
							<td class="col-num">{i + 1}</td>
							<td class="col-preview">{chunkLabel(chunk)}</td>
							<td class="col-status">
								{row ? statusIcon(row.status) : '⏳'}
								{#if row?.status === 'translating'}<span class="spinning">⟳</span>{/if}
							</td>
							<td class="col-tokens">
								{#if row && row.inputTokens > 0}
									{(row.inputTokens + row.outputTokens).toLocaleString()}
								{/if}
							</td>
							<td class="col-actions" onclick={(e) => e.stopPropagation()}>
								{#if row?.status === 'error'}
									<button class="btn-sm retry" onclick={() => retryChunk(i)}>Retry</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Detail panel -->
		{#if selectedIndex !== null}
			{@const idx = selectedIndex}
			{@const src = data.chunks[idx] ?? ''}
			{@const row = progress[idx]}
			<div class="detail-panel">
				<div class="detail-header">
					<h2>Chunk {idx + 1} of {data.chunks.length}</h2>
					<button class="btn-close" onclick={closeDetail}>✕</button>
				</div>
				<div class="detail-body">
					<div class="detail-col">
						<h3>Swedish (source)</h3>
						<pre class="text-pane">{src}</pre>
					</div>
					<div class="detail-col">
						<h3>English (translation)</h3>
						{#if row?.status === 'done' && row.translation}
							<pre class="text-pane translated">{row.translation}</pre>
						{:else if row?.status === 'error'}
							<div class="error-box">
								<strong>Error:</strong> {row.error}
								<button class="btn-sm retry" onclick={() => retryChunk(idx)}>Retry</button>
							</div>
						{:else if row?.status === 'translating'}
							<div class="translating-box">⟳ Translating…</div>
						{:else}
							<div class="pending-box">Not yet translated.</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

	</div>
</div>

<style>
	:global(*, *::before, *::after) { box-sizing: border-box; }
	:global(body) {
		margin: 0;
		font-family: system-ui, -apple-system, sans-serif;
		background: #0f0f12;
		color: #d0cfc5;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}

	/* ── Header ── */
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		background: #1a1a22;
		border-bottom: 1px solid #2e2e3a;
		flex-shrink: 0;
	}
	header h1 {
		margin: 0;
		font-size: 1.1rem;
		color: #c8a96e;
		letter-spacing: 0.04em;
	}
	.stats { display: flex; gap: 1rem; flex-wrap: wrap; }
	.stat { font-size: 0.85rem; }
	.done-stat { color: #6bcb77; }
	.error-stat { color: #e05c5c; }
	.token-stat { color: #8ab4f8; }

	/* ── Progress bar ── */
	.progress-bar-container {
		position: relative;
		height: 6px;
		background: #2a2a35;
		flex-shrink: 0;
	}
	.progress-bar {
		height: 100%;
		background: linear-gradient(90deg, #c8a96e, #e0c080);
		transition: width 0.4s ease;
	}
	.progress-label {
		position: absolute;
		right: 0.5rem;
		top: -1.2rem;
		font-size: 0.7rem;
		color: #888;
	}

	/* ── Controls ── */
	.controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #16161e;
		border-bottom: 1px solid #2e2e3a;
		flex-shrink: 0;
		flex-wrap: wrap;
	}
	.btn {
		padding: 0.35rem 0.9rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.btn:disabled { opacity: 0.4; cursor: default; }
	.btn.primary   { background: #c8a96e; color: #11110e; }
	.btn.secondary { background: #2e2e3a; color: #ccc; }
	.btn.warning   { background: #d97706; color: #fff; }
	.btn.success   { background: #16a34a; color: #fff; }
	.btn.danger    { background: #7f1d1d; color: #fca5a5; }
	.job-status-label { font-size: 0.85rem; color: #8ab4f8; margin-left: 0.5rem; }

	/* ── Content layout ── */
	.content {
		display: flex;
		min-height: 0;
		flex: 1;
		overflow: hidden;
	}

	/* ── Chunk list ── */
	.chunk-list {
		flex: 1;
		overflow-y: auto;
		min-width: 0;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}
	thead th {
		position: sticky;
		top: 0;
		background: #1a1a22;
		padding: 0.45rem 0.6rem;
		text-align: left;
		color: #888;
		border-bottom: 1px solid #2e2e3a;
		font-weight: 600;
	}
	.chunk-row {
		cursor: pointer;
		border-bottom: 1px solid #1e1e28;
		transition: background 0.1s;
	}
	.chunk-row:hover { background: #1f1f2c; }
	.chunk-row.selected { background: #252535; }
	.chunk-row td { padding: 0.35rem 0.6rem; vertical-align: middle; }
	.col-num    { width: 2.8rem; color: #666; text-align: right; padding-right: 0.8rem; }
	.col-preview { color: #bbb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40vw; }
	.col-status { width: 5rem; text-align: center; }
	.col-tokens { width: 6rem; text-align: right; color: #8ab4f8; font-size: 0.75rem; }
	.col-actions { width: 4.5rem; text-align: center; }

	/* Row status tints */
	.chunk-row.done .col-preview   { color: #6bcb77; }
	.chunk-row.error .col-preview  { color: #e05c5c; }
	.chunk-row.translating .col-preview { color: #facc15; }

	.spinning { display: inline-block; animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.btn-sm {
		padding: 0.15rem 0.5rem;
		border: 1px solid currentColor;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.75rem;
		background: transparent;
	}
	.btn-sm.retry { color: #fb923c; }

	/* ── Detail panel ── */
	.detail-panel {
		width: 50%;
		min-width: 320px;
		max-width: 60%;
		display: flex;
		flex-direction: column;
		border-left: 1px solid #2e2e3a;
		background: #13131a;
		overflow: hidden;
	}
	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.8rem;
		background: #1a1a22;
		border-bottom: 1px solid #2e2e3a;
		flex-shrink: 0;
	}
	.detail-header h2 { margin: 0; font-size: 0.9rem; color: #c8a96e; }
	.btn-close {
		background: transparent;
		border: none;
		color: #888;
		cursor: pointer;
		font-size: 1rem;
		padding: 0 0.3rem;
	}
	.btn-close:hover { color: #ccc; }

	.detail-body {
		display: flex;
		flex: 1;
		overflow: hidden;
		gap: 0;
	}
	.detail-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-right: 1px solid #2e2e3a;
		padding: 0.5rem;
	}
	.detail-col:last-child { border-right: none; }
	.detail-col h3 {
		margin: 0 0 0.4rem;
		font-size: 0.8rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.text-pane {
		flex: 1;
		overflow-y: auto;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 0.78rem;
		line-height: 1.55;
		color: #ccc;
		background: #0f0f14;
		padding: 0.5rem;
		border-radius: 4px;
		margin: 0;
		font-family: 'Consolas', 'Courier New', monospace;
	}
	.text-pane.translated { color: #a8d8b0; }

	.error-box {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.6rem;
		background: #3b0f0f;
		border-radius: 4px;
		color: #fca5a5;
		font-size: 0.8rem;
	}
	.translating-box, .pending-box {
		padding: 0.6rem;
		font-size: 0.85rem;
		color: #888;
	}
</style>
