import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../icons";

export default function SelectField({
  value,
  onChange,
  options,
  disabled = false,
  label,
}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (event) =>
      !root.current?.contains(event.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const selected =
    options.find((option) => option.value === String(value)) ?? options[0];
  return (
    <div
      className={`custom-select ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
      ref={root}
    >
      <button
        type="button"
        className="select-trigger"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
      >
        <span>{selected.label}</span>
        <Icon name="chevronDown" size={15} />
      </button>
      {open && (
        <div className="select-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === String(value)}
              className={option.value === String(value) ? "selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === String(value) && (
                <Icon name="check" size={14} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
