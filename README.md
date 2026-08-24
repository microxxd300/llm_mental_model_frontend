# Text Toolkit — frontend

A single-screen React client for the [AI Text Toolkit API](https://github.com/microxxd300/llm_mental_model).

Paste text, then summarize, rewrite, or translate it — and see the token usage,
latency, and what the same request would have cost on a hosted model. The usage
accounting is the point of the product, so the interface treats it as the payload
rather than as debug output.

## Stack

- **React 19** + **TypeScript**, built with **Vite**
- No UI framework and no CSS utility library — the styles are hand-written
  around a small set of design tokens in `src/index.css`
- No runtime dependencies beyond React itself

## Running it

```bash
npm install
cp .env.example .env.local     # then edit the URL if needed
npm run dev
```

| Variable | Meaning |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the API, no trailing slash. Defaults to `http://127.0.0.1:8000`. |

> The API must send CORS headers allowing this origin, or the browser will block
> every request. See the backend README.

## Structure

```
src/
├── api.ts                     typed client; unwraps the {data, error, message}
│                              envelope, maps HTTP status to error kinds, and
│                              normalizes each endpoint's output key
├── App.tsx                    state machine: idle → loading → done | error
├── index.css                  design tokens, reset, base typography
├── app.css                    component styles
└── components/
    ├── ModeSwitch.tsx         summarize / rewrite / translate
    ├── Composer.tsx           textarea, counter, mode-specific inputs, submit
    ├── ResultPanel.tsx        the four states, plus copy-to-clipboard
    └── MetricRail.tsx         token / latency / cost readout
```

### Notes on a few decisions

**Errors are classified, not just displayed.** `api.ts` maps status codes to a
`kind` — `validation`, `rate_limit`, `provider`, `network` — so the UI can say
something specific instead of "Error 400". A rejected input, a throttled client,
and a model outage are three different problems for the person reading the
screen.

**Input limits are duplicated from the serializer.** `MIN_CHARS` and `MAX_CHARS`
mirror the API so an obviously invalid request never leaves the browser. The
server still enforces them — client-side validation is a convenience, never a
control.

**Requests are abortable.** Submitting again cancels the in-flight request via
`AbortController`, so a slow response can't overwrite a newer one.

**The accent colour appears in exactly one place.** Only the cost metric and the
character counter near its limit use it, which is what makes the numbers read as
the subject of the page.

**Each endpoint names its output differently** — `summary`, `rewrite`,
`translation` — so `api.ts` normalizes them to a single `output` field. The
components never branch on which endpoint ran, the same way the backend's service
layer normalizes two providers into one result shape.

**Switching modes clears the result.** A summary still on screen under a
"Translation" heading would be actively misleading.

**Cold starts are explained, not hidden.** If a request runs past six seconds the
panel says why, because a serverless instance waking up looks identical to a
broken app.

## Scripts

```bash
npm run dev       # dev server
npm run build     # typecheck + production build
npm run preview   # serve the production build
npm run lint      # oxlint
```
