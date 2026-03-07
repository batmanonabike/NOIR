import { useState, useRef, useCallback } from "react";

const SYSTEM_PROMPT = `You are a professional translator specializing in Swedish to English translation of tabletop RPG rulebooks.

Translate the provided Swedish markdown text to English. Rules:
1. Preserve ALL markdown formatting exactly (##, **, <!-- -->, *italics*, etc.)
2. Keep proper nouns for places (Sandukar, Imperiet) and character names as-is
3. Translate naturally for a native English RPG audience - use genre-appropriate terminology
4. Keep the tone: dark, noir, dystopian
5. Output ONLY the translated markdown, nothing else - no preamble, no explanation`;

export default function NoirTranslator() {
  const [status, setStatus] = useState("idle"); // idle | loading | running | done | error
  const [chunks, setChunks] = useState([]);
  const [translated, setTranslated] = useState([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("noir_api_key") || "");
  const abortRef = useRef(false);
  const translatedRef = useRef([]);

  const handleApiKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    try { localStorage.setItem("noir_api_key", val); } catch {}
  };

  // Load chunks JSON file
  const handleFileLoad = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus("loading");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setChunks(data);

      // Check localStorage for existing progress
      try {
        const savedValue = localStorage.getItem("noir_translated_chunks");
        if (savedValue) {
          const prev = JSON.parse(savedValue);
          if (prev.length > 0 && prev.length <= data.length) {
            translatedRef.current = prev;
            setTranslated([...prev]);
            setCurrentChunk(prev.length);
            setLoadedFromStorage(true);
            setStatus("paused");
            return;
          }
        }
      } catch {}

      setStatus("ready");
    } catch (err) {
      setErrorMsg("Failed to parse JSON: " + err.message);
      setStatus("error");
    }
  };

  const translateChunk = async (chunkText) => {
    const url = `/api/gemini/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: `Translate this Swedish RPG markdown to English:\n\n${chunkText}` }] }],
        generationConfig: { maxOutputTokens: 8000 },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error ${response.status}: ${err}`);
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  };

  const runTranslation = useCallback(async (startIdx, isTestMode = false) => {
    abortRef.current = false;
    setStatus("running");
    setErrorMsg("");

    for (let i = startIdx; i < chunks.length; i++) {
      if (abortRef.current) {
        setStatus("paused");
        return;
      }

      setCurrentChunk(i);

      try {
        const result = await translateChunk(chunks[i]);
        translatedRef.current = [...translatedRef.current, result];
        setTranslated([...translatedRef.current]);

        // Save progress to localStorage every chunk
        try {
          localStorage.setItem("noir_translated_chunks", JSON.stringify(translatedRef.current));
        } catch {}

        if (isTestMode) {
          setStatus("paused");
          return;
        }

        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        setErrorMsg(`Error on chunk ${i + 1}: ${err.message}`);
        setStatus("error");
        return;
      }
    }

    setStatus("done");
  }, [chunks]);

  const handleStart = () => {
    if (!apiKey.trim()) {
      setErrorMsg("Enter your Google Gemini API key above before starting.");
      setStatus("error");
      return;
    }
    const startIdx = translatedRef.current.length;
    runTranslation(startIdx, testMode);
  };

  const handlePause = () => {
    abortRef.current = true;
  };

  const handleResume = () => {
    if (!apiKey.trim()) {
      setErrorMsg("Enter your Google Gemini API key above before resuming.");
      setStatus("error");
      return;
    }
    const startIdx = translatedRef.current.length;
    runTranslation(startIdx, testMode);
  };

  const handleReset = () => {
    abortRef.current = true;
    translatedRef.current = [];
    setTranslated([]);
    setCurrentChunk(0);
    setStatus("ready");
    try { localStorage.removeItem("noir_translated_chunks"); } catch {}
  };

  const handleDownload = () => {
    const fullText = translatedRef.current.join("\n\n");
    const blob = new Blob([fullText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Noir_Player_Safe_English.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pct = chunks.length > 0 ? Math.round((translated.length / chunks.length) * 100) : 0;

  return (
    <div style={{ fontFamily: "monospace", maxWidth: 700, margin: "40px auto", padding: 24, background: "#111", color: "#e0d6c8", borderRadius: 8 }}>
      <h1 style={{ color: "#c9a84c", fontSize: 22, marginBottom: 4 }}>🕵️ Noir RPG Translator</h1>
      <p style={{ color: "#888", marginBottom: 24, fontSize: 13 }}>Swedish → English · 99 chunks · ~283 pages</p>

      {status === "idle" && (
        <div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", color: "#888", fontSize: 12, marginBottom: 6 }}>Google Gemini API Key <span style={{ color: "#6a9e6a" }}>(free — no credit card needed)</span></label>
            <input
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="AIza..."
              style={{ width: "100%", background: "#1a1a1a", border: "1px solid #444", color: "#e0d6c8", padding: "8px 12px", borderRadius: 4, fontFamily: "monospace", fontSize: 13, boxSizing: "border-box" }}
            />
            <p style={{ color: "#555", fontSize: 11, marginTop: 4 }}>Saved in localStorage. Get a free key at aistudio.google.com → Get API key.</p>
          </div>
          <p style={{ marginBottom: 12 }}>Load the <strong>noir_chunks.json</strong> file to begin:</p>
          <input type="file" accept=".json" onChange={handleFileLoad}
            style={{ color: "#e0d6c8", background: "#222", border: "1px solid #444", padding: "8px 12px", borderRadius: 4, cursor: "pointer" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer", color: "#c9a84c", fontSize: 13 }}>
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)}
              style={{ accentColor: "#c9a84c", width: 15, height: 15, cursor: "pointer" }} />
            Test mode — translate only the first chunk
          </label>
        </div>
      )}

      {status === "loading" && <p style={{ color: "#c9a84c" }}>Loading chunks...</p>}

      {(status === "ready" || status === "paused" || status === "running" || status === "done" || status === "error") && chunks.length > 0 && (
        <div>
          <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#888" }}>Progress</span>
              <span style={{ color: "#c9a84c", fontWeight: "bold" }}>{translated.length} / {chunks.length} chunks ({pct}%)</span>
            </div>
            <div style={{ background: "#333", borderRadius: 4, height: 12, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #c9a84c, #e8c96a)", transition: "width 0.4s" }} />
            </div>
            {status === "running" && (
              <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
                Translating chunk {currentChunk + 1}...
              </p>
            )}
            {loadedFromStorage && status === "paused" && (
              <p style={{ color: "#6a9e6a", fontSize: 12, marginTop: 8 }}>
                ✓ Resumed from saved progress ({translated.length} chunks already done)
              </p>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", color: "#c9a84c", fontSize: 13 }}>
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)}
              style={{ accentColor: "#c9a84c", width: 15, height: 15, cursor: "pointer" }} />
            Test mode — translate only one chunk at a time
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {status === "ready" && (
              <button onClick={handleStart}
                style={{ background: "#c9a84c", color: "#111", border: "none", padding: "10px 20px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                ▶ Start Translation
              </button>
            )}
            {status === "paused" && (
              <button onClick={handleResume}
                style={{ background: "#c9a84c", color: "#111", border: "none", padding: "10px 20px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                ▶ Resume
              </button>
            )}
            {status === "running" && (
              <button onClick={handlePause}
                style={{ background: "#555", color: "#e0d6c8", border: "none", padding: "10px 20px", borderRadius: 4, cursor: "pointer" }}>
                ⏸ Pause
              </button>
            )}
            {(status === "done" || status === "paused" || status === "error") && translated.length > 0 && (
              <button onClick={handleDownload}
                style={{ background: "#2a5e2a", color: "#e0d6c8", border: "none", padding: "10px 20px", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}>
                ⬇ Download English Markdown
              </button>
            )}
            {status !== "running" && (
              <button onClick={handleReset}
                style={{ background: "transparent", color: "#666", border: "1px solid #444", padding: "10px 20px", borderRadius: 4, cursor: "pointer" }}>
                ↺ Reset
              </button>
            )}
          </div>

          {status === "done" && (
            <div style={{ marginTop: 20, padding: 14, background: "#1a2e1a", border: "1px solid #2a5e2a", borderRadius: 6 }}>
              <p style={{ color: "#6abf6a", margin: 0 }}>✓ Translation complete! Click "Download English Markdown" to save your file.</p>
            </div>
          )}

          {status === "error" && (
            <div style={{ marginTop: 20, padding: 14, background: "#2e1a1a", border: "1px solid #5e2a2a", borderRadius: 6 }}>
              <p style={{ color: "#bf6a6a", margin: 0 }}>⚠ {errorMsg}</p>
              <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>Progress saved. You can resume after a moment.</p>
              <button onClick={handleResume} style={{ marginTop: 8, background: "#c9a84c", color: "#111", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}>
                ↺ Retry
              </button>
            </div>
          )}

          {translated.length > 0 && (
            <div style={{ marginTop: 20, background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, padding: 14, maxHeight: 200, overflowY: "auto" }}>
              <p style={{ color: "#666", fontSize: 11, margin: "0 0 8px" }}>Latest translated output preview:</p>
              <pre style={{ color: "#a09080", fontSize: 11, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {translated[translated.length - 1]?.slice(0, 600)}...
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
