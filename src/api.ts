/**
 * Client for the AI Text Toolkit API.
 *
 * Every response from that API is wrapped in the same envelope:
 *   { data: T | null, error: unknown | null, message: string }
 * so unwrapping and error shaping live here rather than in components.
 */

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

export const MODES = ["summarize", "rewrite", "translate"] as const;
export type Mode = (typeof MODES)[number];

export const TONES = [
  "neutral",
  "formal",
  "casual",
  "confident",
  "friendly",
] as const;
export type Tone = (typeof TONES)[number];

/** Each endpoint names its output differently; this maps them to one field. */
const OUTPUT_KEY: Record<Mode, string> = {
  summarize: "summary",
  rewrite: "rewrite",
  translate: "translation",
};

export const MODE_LABELS: Record<Mode, { verb: string; result: string }> = {
  summarize: { verb: "Summarize", result: "Summary" },
  rewrite: { verb: "Rewrite", result: "Rewrite" },
  translate: { verb: "Translate", result: "Translation" },
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

/** The API result, with the per-endpoint output key normalized to `output`. */
export interface ToolkitResult {
  output: string;
  provider: string;
  model: string;
  truncated: boolean;
  usage: Usage;
  cost_usd: string;
  equivalent_cost_usd: Record<string, string>;
}

export type ApiErrorKind =
  | "validation"
  | "rate_limit"
  | "provider"
  | "network"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Field name -> messages, for validation failures. */
  readonly fields?: Record<string, string[]>;
  /** Seconds to wait, when the server sent Retry-After. */
  readonly retryAfter?: number;

  constructor(
    kind: ApiErrorKind,
    status: number,
    message: string,
    extra?: { fields?: Record<string, string[]>; retryAfter?: number },
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.fields = extra?.fields;
    this.retryAfter = extra?.retryAfter;
  }
}

interface Envelope<T> {
  data: T | null;
  error: unknown;
  message: string;
}

/** DRF puts a single human-readable string under `detail`. */
function readDetail(error: unknown): string | null {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return null;
}

/** Serializer errors arrive as { fieldName: ["message", ...] }. */
function readFields(error: unknown): Record<string, string[]> | undefined {
  if (!error || typeof error !== "object" || "detail" in error) return undefined;
  const fields: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(error)) {
    if (Array.isArray(value)) fields[key] = value.map(String);
  }
  return Object.keys(fields).length ? fields : undefined;
}

function toApiError(
  status: number,
  body: Envelope<unknown> | null,
  retryAfterHeader: string | null,
): ApiError {
  const detail = readDetail(body?.error);
  const fields = readFields(body?.error);
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;

  if (status === 400) {
    const first = fields ? Object.values(fields)[0]?.[0] : null;
    return new ApiError(
      "validation",
      status,
      first ?? detail ?? "That input was rejected.",
      { fields },
    );
  }
  if (status === 429) {
    return new ApiError("rate_limit", status, detail ?? "Rate limit reached.", {
      retryAfter,
    });
  }
  if (status === 503) {
    return new ApiError("provider", status, detail ?? "The model is unavailable.");
  }
  return new ApiError(
    "unknown",
    status,
    detail ?? body?.message ?? `Request failed (${status}).`,
  );
}

export interface RunOptions {
  tone?: Tone;
  targetLanguage?: string;
}

interface RunResponse {
  result: ToolkitResult;
  /** Round-trip time measured in the browser, in milliseconds. */
  latencyMs: number;
}

function buildBody(mode: Mode, text: string, options: RunOptions) {
  if (mode === "rewrite") return { text, tone: options.tone ?? "neutral" };
  if (mode === "translate")
    return { text, target_language: options.targetLanguage ?? "" };
  return { text };
}

export async function run(
  mode: Mode,
  text: string,
  options: RunOptions = {},
  signal?: AbortSignal,
): Promise<RunResponse> {
  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/v1/${mode}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(mode, text, options)),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(
      "network",
      0,
      "Could not reach the API. Check that it is running and that VITE_API_BASE_URL is correct.",
    );
  }

  const latencyMs = Math.round(performance.now() - startedAt);

  let body: Envelope<Record<string, unknown>> | null = null;
  try {
    body = (await response.json()) as Envelope<Record<string, unknown>>;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.data) {
    throw toApiError(response.status, body, response.headers.get("Retry-After"));
  }

  const data = body.data;
  const output = data[OUTPUT_KEY[mode]];
  if (typeof output !== "string") {
    throw new ApiError("unknown", response.status, "The API returned an unexpected shape.");
  }

  return {
    result: {
      output,
      provider: String(data.provider ?? ""),
      model: String(data.model ?? ""),
      truncated: Boolean(data.truncated),
      usage: data.usage as Usage,
      cost_usd: String(data.cost_usd ?? "0"),
      equivalent_cost_usd: (data.equivalent_cost_usd ?? {}) as Record<string, string>,
    },
    latencyMs,
  };
}
