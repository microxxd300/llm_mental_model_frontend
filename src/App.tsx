import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, summarize, type SummarizeResult } from "./api";
import Composer from "./components/Composer";
import ResultPanel from "./components/ResultPanel";

// Mirrors the serializer limits on the API. Validating here too means an
// obviously bad request never leaves the browser; the server still enforces it.
const MIN_CHARS = 20;
const MAX_CHARS = 10_000;

type Status = "idle" | "loading" | "error" | "done";

export default function App() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SummarizeResult | null>(null);
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

  const trimmed = text.trim();
  const canSubmit =
    trimmed.length >= MIN_CHARS &&
    text.length <= MAX_CHARS &&
    status !== "loading";

  const run = useCallback(async () => {
    if (!canSubmit) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);
    setSlow(false);

    try {
      const response = await summarize(trimmed, controller.signal);
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
  }, [canSubmit, trimmed]);

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead__mark">
          <span className="masthead__title">Text&nbsp;Toolkit</span>
          <span className="masthead__rule" aria-hidden="true" />
          <span className="masthead__kicker">summarize</span>
        </div>
        <p className="masthead__lede">
          Summarize text through a language model — and see exactly how many
          tokens it cost, and what those tokens would have cost on a hosted
          model.
        </p>
      </header>

      <main className="stack">
        <Composer
          value={text}
          onChange={setText}
          onSubmit={() => void run()}
          disabled={!canSubmit}
          busy={status === "loading"}
          min={MIN_CHARS}
          max={MAX_CHARS}
        />

        <ResultPanel
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
