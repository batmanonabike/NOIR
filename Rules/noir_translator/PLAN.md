# Noir RPG Translator — Execution Plan

> **AI: Read this file first at the start of every session.**

## Project Goal

Translate the *Noir* Swedish tabletop RPG rulebook from Swedish to English.

- **Source format**: GitHub Markdown
- **Target format**: GitHub Markdown
- **AI engine**: Google Gemini

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | SvelteKit 2.x + Svelte 5 (runes syntax) |
| Language | TypeScript — strict mode, no `any`, no `allowJs` |
| AI SDK | `@google/generative-ai` (latest Gemini SDK) |
| Build tool | Vite 6.x |
| Package manager | npm |

---

## Directory Layout

```
noir_translator/
  PLAN.md                     ← this file — AI reads first every session
  00_simple_gemini_call/      ← Phase 0: Basic Gemini API connectivity test
  01_chunked_batch/           ← Phase 1: Resumable batch translator (future)
  02_page_remapper/           ← Phase 2: Page number remapping (future)
  03_image_handler/           ← Phase 3: Image extraction & placement (future)
```

---

## Phase Roadmap

### ✅ Phase 0 — `00_simple_gemini_call`

**Goal**: Prove end-to-end Gemini connectivity before building any batch infrastructure.

- Paste Swedish text → click Translate → see English output
- Token usage shown in UI
- API key is **server-side only** — never in the client bundle
- SvelteKit server route (`+server.ts`) proxies the Gemini call

**Status**: Implementation complete. Run `npm install` then `npm run dev`.

### � Phase 1 — Chunked Batch Translator (resumable)

**Directory**: `noir_translator/01_chunked_batch/`

**Goal**: Translate all 99 chunks from `noir_chunks.json` with full pause/resume support
so credit exhaustion or a browser close never loses work.

#### Resume Mechanism

Progress is stored in `localStorage` under the key `noir-translation-v1` as a
`TranslationProgress` JSON object:

```typescript
interface ChunkProgress {
  status: 'pending' | 'translating' | 'done' | 'error';
  translation: string | null;  // null = not yet translated
  error: string | null;        // null = no error
  inputTokens: number;
  outputTokens: number;
}

interface TranslationProgress {
  version: 1;
  chunkCount: number;          // must match current chunks.length (99)
  startedAt: string;           // ISO timestamp of first run
  updatedAt: string;           // ISO timestamp of last save
  chunks: ChunkProgress[];     // one entry per source chunk, index-aligned
}
```

**On page load**:
1. Read `localStorage['noir-translation-v1']`
2. If found AND `chunkCount === 99` → restore state, any `translating` chunks reset to `pending`
3. Otherwise → fresh init (all chunks `pending`)

**Reviewing completed work**:
- Chunk list table shows all 99 rows with status badge: ✅ done | ⏳ pending | ❌ error
- Click any row to expand a detail panel with source + translation side-by-side
- Token counts per chunk + running totals in the header stats bar

#### Controls

| Button | When visible | Action |
|--------|-------------|--------|
| Start | idle | Initialise progress and begin queue |
| Resume | paused | Continue from first non-done chunk |
| Pause | running | Set `shouldPause` flag; finishes current in-flight request then stops |
| Retry (per row) | error on that chunk | Re-translate that single chunk |
| Reset | any | Confirm dialog → clear localStorage → fresh state |
| Download | any | Merge all translations (untranslated chunks marked) → save `.md` file |

#### Translation Queue

- Chunks are processed sequentially (one at a time) to avoid rate limits
- After each chunk, state is persisted to `localStorage`
- Errors on individual chunks do not stop the queue — mark as `error`, continue

#### Data Flow

```
+page.server.ts  →  load()  →  readFileSync(noir_chunks.json)
                                        ↓
                              PageData.chunks: string[]  (99 items)
                                        ↓
                              +page.svelte  →  localStorage resume check
                                        ↓
                              runQueue()  →  POST /api/translate  →  Gemini
                                        ↓
                              saveProgress()  →  localStorage
```

### 📋 Phase 2 — Page Number Remapping

Page references like *"se sidan 354"* become meaningless after translation because the
translated document has different pagination.

**Strategy**:

1. During chunking, record `heading → original page number` mapping
2. During translation, flag all `sidan X` / `page X` patterns
3. Post-process output: replace stale page refs with anchor links to translated headings

### 📋 Phase 3 — Image Extraction & Placement

- Inventory all `![alt](path)` image references in source markdown
- Preserve image references at the correct relative positions in translated output
- Validate that image paths remain valid in the output directory structure

### 📋 Phase 4 — Full Pipeline

- End-to-end: input `.md` → chunk → translate → remap pages → fix images → output `.md`
- All progress persisted across browser sessions
- Per-chunk retry; no full restart required

---

## Key Conventions

- **TypeScript strict mode** in every `.ts` and `.svelte` file — `strict: true`,
  `noImplicitAny: true`, `strictNullChecks: true`, `allowJs: false`
- **Svelte 5 runes** everywhere: `$state`, `$derived`, `$effect` — no legacy `$:` or `writable()`
- **Svelte event syntax**: `onclick={fn}` — NOT ~~`on:click={fn}`~~
- **API key**: `GEMINI_API_KEY` in `.env.local` — accessed via `$env/static/private` (server-side only)
- **Default model**: `gemini-2.0-flash` — change `GEMINI_MODEL` constant in
  `src/routes/api/translate/+server.ts` to switch models
- All functions must have explicit return types
- No `as any` casts; use proper type guards instead

---

## Gemini API Key Setup (one-time)

1. Go to <https://aistudio.google.com/app/apikey>
2. Sign in with a Google account and **Create API key**
3. `cd noir_translator/00_simple_gemini_call`
4. Copy `.env.example` → `.env.local`
5. Paste: `GEMINI_API_KEY=AIza...`
6. **Never commit `.env.local`** — it is gitignored

---

## Running Phase 0

```powershell
cd noir_translator/00_simple_gemini_call
npm install        # first time only
npm run dev        # dev server → http://localhost:5173
npm run check      # TypeScript type-check (run before committing)
npm run build      # production build
```

## Running Phase 1

```powershell
cd noir_translator/01_chunked_batch
npm install        # first time only
# Copy .env.local from Phase 0 or create a fresh one:
#   GEMINI_API_KEY=AIza...
npm run dev        # dev server → http://localhost:5173
npm run check      # TypeScript type-check
```

**Resuming a previous session**: open the app — if `localStorage` contains a saved session
matching the current 99 chunks, it will be automatically restored and the status will show
⏸ Paused. Click **Resume** to continue from the first non-done chunk.

---

## Translation Prompt Strategy

- **Role**: Professional Swedish → English RPG translator
- Preserve **all** markdown formatting exactly: `##`, `**bold**`, `*italic*`, `<!-- comments -->`, tables
- Keep proper nouns unchanged: *Sandukar*, *Imperiet*, character names, place names
- Use genre-appropriate terminology for an English RPG audience
- Tone: dark, noir, dystopian
- Output **only** the translated markdown — no preamble, no explanation, no ` ```markdown ` fences

---

## Source Files Reference

| File | Purpose |
|---|---|
| `Noir_Player_Safe_Swedish.md` | Full Swedish source document |
| `TranslationTempFiles/noir_chunks.json` | Pre-split source chunks (used in Phase 1) |
| `noir-translator_old/src/App.jsx` | Original React prototype — useful for UI/prompt reference only |
