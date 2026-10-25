import React from "react";
import { Icon } from "../../icons";

export default function TabSwitch({
  value,
  onChange,
  options,
  label,
  className = "",
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      className={`tab-switch ${className}`}
      role="group"
      aria-label={label}
      style={{ "--tab-count": options.length, "--tab-index": activeIndex }}
    >
      <i className="tab-switch-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          type="button"
          className={option.value === value ? "active" : ""}
          aria-pressed={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <Icon name={option.icon} size={15} />}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
