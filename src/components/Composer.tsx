import { type KeyboardEvent } from "react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  busy: boolean;
  min: number;
  max: number;
}

export default function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  busy,
  min,
  max,
}: ComposerProps) {
  const length = value.trim().length;
  const tooShort = length > 0 && length < min;
  const overLimit = value.length > max;

  // Counter earns attention only when the input is actually unusable.
  const counterState = overLimit ? "over" : tooShort ? "short" : "ok";

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <section className="composer" aria-labelledby="composer-label">
      <div className="composer__head">
        <label className="composer__label" id="composer-label" htmlFor="source-text">
          Source text
        </label>
        <span className={`counter counter--${counterState}`}>
          {overLimit ? (
            <>{new Intl.NumberFormat().format(value.length - max)} over limit</>
          ) : tooShort ? (
            <>{min - length} more characters</>
          ) : (
            <>
              {new Intl.NumberFormat().format(value.length)}
              <span className="counter__sep"> / </span>
              {new Intl.NumberFormat().format(max)}
            </>
          )}
        </span>
      </div>

      <textarea
        id="source-text"
        className="composer__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={9}
        spellCheck={false}
        placeholder="Paste an article, a set of notes, a transcript…"
        aria-describedby="composer-hint"
      />

      <div className="composer__foot">
        <p className="composer__hint" id="composer-hint">
          <kbd>{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}</kbd>
          <kbd>Enter</kbd>
          <span>to summarize</span>
        </p>

        <button
          type="button"
          className="button"
          onClick={onSubmit}
          disabled={disabled}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Summarizing
            </>
          ) : (
            "Summarize"
          )}
        </button>
      </div>
    </section>
  );
}
