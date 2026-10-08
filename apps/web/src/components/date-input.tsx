import { useRef, useState, type InputHTMLAttributes } from "react";

// A native <input type="date"> follows the browser language (mm/dd/yyyy in an English browser), so every date field
// shows and accepts dd/mm/yyyy here instead. The value stays ISO yyyy-mm-dd ("" when empty) and onChange receives an
// event-like object, so call sites only swap the element. Typing emits once the date is complete and valid; a partial
// or invalid entry reverts on blur. The calendar button opens the browser picker.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "defaultValue"> & {
  value: string;
  onChange: (event: { target: { value: string } }) => void;
};

const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
const display = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function formatDisplayDate(value: string) {
  const match = iso.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

// Accepts dd/mm/yyyy (or a pasted yyyy-mm-dd) and returns the ISO date, or null when it is not a real date.
export function parseDisplayDate(text: string): string | null {
  const trimmed = text.trim();
  const fromIso = iso.exec(trimmed);
  const fromDisplay = display.exec(trimmed);
  const parts = fromIso ? [fromIso[1], fromIso[2], fromIso[3]] : fromDisplay ? [fromDisplay[3], fromDisplay[2], fromDisplay[1]] : null;
  if (!parts) return null;
  const [year, month, day] = parts.map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
}

// Inserts the slashes while typing digits: 0810 -> 08/10, 08102026 -> 08/10/2026.
function mask(text: string) {
  if (/[^\d/]/.test(text) || text.includes("-")) return text;
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (text.includes("/")) return text.slice(0, 10);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export function DateInput({ value, onChange, onBlur, min, max, disabled, required, className, ...rest }: Props) {
  const [text, setText] = useState(formatDisplayDate(value));
  // The last value this field showed or emitted; a different value from the parent replaces the text in the same render.
  const [synced, setSynced] = useState(value);
  const picker = useRef<HTMLInputElement>(null);
  if (value !== synced) {
    setSynced(value);
    setText(formatDisplayDate(value));
  }
  const emit = (next: string) => {
    setSynced(next);
    onChange({ target: { value: next } });
  };
  return (
    <span className={`date-input${className ? ` ${className}` : ""}`}>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        disabled={disabled}
        required={required}
        value={text}
        onChange={(event) => {
          const next = mask(event.target.value);
          setText(next);
          if (!next.trim()) {
            if (value !== "") emit("");
            return;
          }
          const parsed = parseDisplayDate(next);
          if (parsed) {
            setText(formatDisplayDate(parsed));
            if (parsed !== value) emit(parsed);
          }
        }}
        onBlur={(event) => {
          if (text.trim() && !parseDisplayDate(text)) setText(formatDisplayDate(value));
          onBlur?.(event);
        }}
      />
      <button
        type="button"
        className="date-input-picker"
        aria-label="Chọn ngày trên lịch"
        title="Chọn ngày trên lịch"
        disabled={disabled}
        onClick={() => {
          const input = picker.current;
          if (!input) return;
          if (typeof input.showPicker === "function") input.showPicker();
          else input.focus();
        }}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6.5h12M5 1.8v2.6M11 1.8v2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      <input
        ref={picker}
        type="date"
        className="date-input-native"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          setText(formatDisplayDate(event.target.value));
          emit(event.target.value);
        }}
      />
    </span>
  );
}
