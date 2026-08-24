import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  run,
  type Mode,
  type Tone,
  type ToolkitResult,
} from "./api";
import Composer from "./components/Composer";
import ResultPanel from "./components/ResultPanel";

// Mirrors the serializer limits on the API. Validating here too means an
// obviously bad request never leaves the browser; the server still enforces it.
const MIN_CHARS = 20;
const MAX_CHARS = 10_000;

type Status = "idle" | "loading" | "error" | "done";

export default function App() {
  const [mode, setMode] = useState<Mode>("summarize");
  const [text, setText] = useState("");
  const [tone, setTone] = useState<Tone>("neutral");
  const [language, setLanguage] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ToolkitResult | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [slow, setSlow] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Only mention the cold start once the wait is long enough to worry someone.
  // The flag is cleared where the wait begins, not here, so this effect never
  // sets state synchronously on render.
  useEffect(() => {
    if (status !== "loading") return;
    const id = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, [status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // A summary left on screen under the "Translate" heading would be a lie.
  const changeMode = useCallback((next: Mode) => {
    abortRef.current?.abort();
    setMode(next);
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  const trimmed = text.trim();
  const needsLanguage = mode === "translate" && !language.trim();
  const canSubmit =
    trimmed.length >= MIN_CHARS &&
    text.length <= MAX_CHARS &&
    !needsLanguage &&
    status !== "loading";

  const submit = useCallback(async () => {
    if (!canSubmit) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);
    setSlow(false);

    try {
      const response = await run(
        mode,
        trimmed,
        { tone, targetLanguage: language.trim() },
        controller.signal,
      );
      setResult(response.result);
      setLatencyMs(response.latencyMs);
      setStatus("done");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError("unknown", 0, "Something went wrong."),
      );
      setStatus("error");
    }
  }, [canSubmit, language, mode, tone, trimmed]);

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead__mark">
          <span className="masthead__title">Text&nbsp;Toolkit</span>
          <span className="masthead__rule" aria-hidden="true" />
          <span className="masthead__kicker">{mode}</span>
        </div>
        <p className="masthead__lede">
          Summarize, rewrite, or translate text through a language model — and see
          exactly how many tokens it cost, and what those tokens would have cost on
          a hosted model.
        </p>
      </header>

      <main className="stack">
        <Composer
          mode={mode}
          onModeChange={changeMode}
          value={text}
          onChange={setText}
          tone={tone}
          onToneChange={setTone}
          language={language}
          onLanguageChange={setLanguage}
          onSubmit={() => void submit()}
          disabled={!canSubmit}
          busy={status === "loading"}
          min={MIN_CHARS}
          max={MAX_CHARS}
        />

        <ResultPanel
          mode={mode}
          status={status}
          result={result}
          latencyMs={latencyMs}
          error={error}
          slow={slow}
        />
      </main>

      <footer className="colophon">
        <span>Django · DRF · Groq</span>
        <span className="colophon__dot" aria-hidden="true">
          ·
        </span>
        <a
          className="colophon__link"
          href="https://github.com/microxxd300/llm_mental_model"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      </footer>
    </div>
  );
}
