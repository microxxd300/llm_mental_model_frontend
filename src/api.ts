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

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface SummarizeResult {
  summary: string;
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

function toApiError(status: number, body: Envelope<unknown> | null, retryAfterHeader: string | null): ApiError {
  const detail = readDetail(body?.error);
  const fields = readFields(body?.error);
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;

  if (status === 400) {
    const first = fields ? Object.values(fields)[0]?.[0] : null;
    return new ApiError("validation", status, first ?? detail ?? "That input was rejected.", { fields });
  }
  if (status === 429) {
    return new ApiError("rate_limit", status, detail ?? "Rate limit reached.", { retryAfter });
  }
  if (status === 503) {
    return new ApiError("provider", status, detail ?? "The model is unavailable.");
  }
  return new ApiError("unknown", status, detail ?? body?.message ?? `Request failed (${status}).`);
}

interface SummarizeResponse {
  result: SummarizeResult;
  /** Round-trip time measured in the browser, in milliseconds. */
  latencyMs: number;
}

export async function summarize(
  text: string,
  signal?: AbortSignal,
): Promise<SummarizeResponse> {
  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/v1/summarize/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
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

  let body: Envelope<SummarizeResult> | null = null;
  try {
    body = (await response.json()) as Envelope<SummarizeResult>;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.data) {
    throw toApiError(response.status, body, response.headers.get("Retry-After"));
  }

  return { result: body.data, latencyMs };
}
