import React from "react";

export default function Switch({ checked, onChange, label, help }) {
  return (
    <label className="toggle-row">
      <span>
        <b>{label}</b>
        {help && <small>{help}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i />
    </label>
  );
}
