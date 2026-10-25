import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../../icons";

const languages = [
  { value: "en", native: "English", translated: "English" },
  { value: "tr", native: "Türkçe", translated: "Turkish" },
];

export default function LanguagePicker({ open, value, onChange, onClose, t }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term
      ? languages.filter((item) =>
          `${item.native} ${item.translated}`
            .toLocaleLowerCase()
            .includes(term),
        )
      : languages;
  }, [query]);
  if (!open) return null;
  return (
    <div className="language-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="language-picker"
        role="dialog"
        aria-modal="true"
        aria-label={t("chooseLanguage")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <b>{t("chooseLanguage")}</b>
          <button onClick={onClose} aria-label={t("cancel")}>
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="language-list">
          {filtered.map((item) => (
            <button
              key={item.value}
              className={item.value === value ? "active" : ""}
              onClick={() => {
                onChange(item.value);
                onClose();
              }}
            >
              <span>
                <b>{item.native}</b>
                <small>{item.translated}</small>
              </span>
              {item.value === value && <Icon name="check" size={17} />}
            </button>
          ))}
        </div>
        <label className="language-search">
          <Icon name="search" size={16} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
          />
        </label>
      </section>
    </div>
  );
}
