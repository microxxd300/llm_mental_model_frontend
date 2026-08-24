import { MODES, MODE_LABELS, type Mode } from "../api";

interface ModeSwitchProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled: boolean;
}

export default function ModeSwitch({ value, onChange, disabled }: ModeSwitchProps) {
  return (
    <div className="segmented" role="tablist" aria-label="Task">
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={mode === value}
          className="segmented__item"
          disabled={disabled}
          onClick={() => onChange(mode)}
        >
          {MODE_LABELS[mode].verb}
        </button>
      ))}
    </div>
  );
}
