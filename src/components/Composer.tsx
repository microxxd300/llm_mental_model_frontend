import { type KeyboardEvent } from "react";

import { MODE_LABELS, TONES, type Mode, type Tone } from "../api";
import ModeSwitch from "./ModeSwitch";

interface ComposerProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  value: string;
  onChange: (value: string) => void;
  tone: Tone;
  onToneChange: (tone: Tone) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  busy: boolean;
  min: number;
  max: number;
}

export default function Composer({
  mode,
  onModeChange,
  value,
  onChange,
  tone,
  onToneChange,
  language,
  onLanguageChange,
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

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
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

      <ModeSwitch value={mode} onChange={onModeChange} disabled={busy} />

      <textarea
        id="source-text"
        className="composer__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={8}
        spellCheck={false}
        placeholder="Paste an article, a set of notes, a transcript…"
        aria-describedby="composer-hint"
      />

      {mode === "rewrite" ? (
        <div className="field">
          <label className="field__label" htmlFor="tone">
            Tone
          </label>
          <select
            id="tone"
            className="field__control"
            value={tone}
            onChange={(event) => onToneChange(event.target.value as Tone)}
          >
            {TONES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {mode === "translate" ? (
        <div className="field">
          <label className="field__label" htmlFor="language">
            Target language
          </label>
          <input
            id="language"
            className="field__control"
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={40}
            placeholder="Tagalog, Spanish, Japanese…"
            autoComplete="off"
          />
        </div>
      ) : null}

      <div className="composer__foot">
        <p className="composer__hint" id="composer-hint">
          <kbd>{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}</kbd>
          <kbd>Enter</kbd>
          <span>to run</span>
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
              Working
            </>
          ) : (
            MODE_LABELS[mode].verb
          )}
        </button>
      </div>
    </section>
  );
}
