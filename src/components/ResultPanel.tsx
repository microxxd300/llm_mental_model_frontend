import { useEffect, useState } from "react";

import type { ApiError, SummarizeResult } from "../api";
import MetricRail from "./MetricRail";

interface ResultPanelProps {
  status: "idle" | "loading" | "error" | "done";
  result: SummarizeResult | null;
  latencyMs: number | null;
  error: ApiError | null;
  slow: boolean;
}

const ERROR_TITLES: Record<string, string> = {
  validation: "That input was rejected",
  rate_limit: "Rate limit reached",
  provider: "The model is unavailable",
  network: "Could not reach the API",
  unknown: "Something went wrong",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      className="ghost-button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ResultPanel({
  status,
  result,
  latencyMs,
  error,
  slow,
}: ResultPanelProps) {
  if (status === "idle") {
    return (
      <section className="panel panel--empty" aria-live="polite">
        <p className="panel__placeholder">
          The summary appears here, with the token usage and cost it took to
          produce.
        </p>
      </section>
    );
  }

  if (status === "loading") {
    return (
      <section className="panel" aria-live="polite" aria-busy="true">
        <div className="skeleton">
          <span className="skeleton__line" />
          <span className="skeleton__line" />
          <span className="skeleton__line skeleton__line--short" />
        </div>
        {slow ? (
          <p className="panel__aside">
            Still working. A serverless instance that has been idle can take
            half a minute to wake up.
          </p>
        ) : null}
      </section>
    );
  }

  if (status === "error" && error) {
    return (
      <section className="panel panel--error" role="alert">
        <p className="notice__title">{ERROR_TITLES[error.kind] ?? ERROR_TITLES.unknown}</p>
        <p className="notice__body">{error.message}</p>
        {error.kind === "rate_limit" && error.retryAfter ? (
          <p className="notice__meta">
            Try again in about {Math.ceil(error.retryAfter / 60)} minutes.
          </p>
        ) : null}
        {error.status ? <p className="notice__meta">HTTP {error.status}</p> : null}
      </section>
    );
  }

  if (status === "done" && result && latencyMs !== null) {
    return (
      <section className="panel" aria-live="polite">
        <div className="panel__head">
          <h2 className="panel__title">Summary</h2>
          <CopyButton text={result.summary} />
        </div>

        <p className="summary">{result.summary}</p>

        {result.truncated ? (
          <p className="panel__aside panel__aside--warn">
            The model hit its output limit, so this summary may be cut off.
          </p>
        ) : null}

        <MetricRail result={result} latencyMs={latencyMs} />
      </section>
    );
  }

  return null;
}
