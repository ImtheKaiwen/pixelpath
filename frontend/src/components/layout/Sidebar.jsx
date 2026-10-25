import React from "react";
import { Icon } from "../../icons";
import UpdateCenter from "../ui/UpdateCenter";

export default function Sidebar({
  open,
  onToggle,
  onNewModel,
  library,
  modelId,
  busy,
  onOpenModel,
  formatNumber,
  language,
  onLanguagePicker,
  t,
}) {
  return (
    <>
      <aside className={`sidebar ${open ? "open" : "collapsed"}`}>
        <div className="brand">
          <button
            className="brand-mark"
            onClick={onToggle}
            aria-label={open ? t("closeMenu") : t("openMenu")}
          >
            <Icon name="menu" size={19} />
          </button>
          <div>
            <strong>PixelPath</strong>
          </div>
        </div>
        <button
          className="button primary new-model"
          onClick={onNewModel}
          data-tooltip={t("newModel")}
          data-tooltip-placement="right"
        >
          <Icon name="plus" />
          <span>{t("newModel")}</span>
        </button>
        <div className="library-head">
          <span>{t("library")}</span>
          <b>{library.length}</b>
        </div>
        <nav className="model-list">
          {library.map((item) => (
            <button
              key={item.id}
              data-tooltip={item.name}
              data-tooltip-placement="right"
              className={`model-row ${item.id === modelId ? "active" : ""}`}
              onClick={() => onOpenModel(item.id)}
            >
              <span className="model-thumb">
                <Icon name="cube" size={18} />
              </span>
              <span className="model-copy">
                <strong>{item.name}</strong>
                <small>
                  {formatNumber.format(item.piece_count)} {t("pieces")}
                </small>
              </span>
              <Icon name="chevron" size={15} className="row-chevron" />
            </button>
          ))}
          {!library.length && !busy && (
            <p className="library-empty">{t("noModels")}</p>
          )}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">✦</span>
          <p>
            <b>{t("privateTitle")}</b>
            <br />
            {t("privateBody")}
          </p>
        </div>
        <UpdateCenter t={t} expanded={open} />
        <button
          className="language-trigger"
          onClick={onLanguagePicker}
          data-tooltip={t("language")}
          data-tooltip-placement="right"
        >
          <Icon name="language" size={17} />
          <span>{language === "tr" ? "Türkçe" : "English"}</span>
          <small>{language.toUpperCase()}</small>
        </button>
        <div className="version">PixelPath · Desktop</div>
      </aside>
      {open && (
        <button
          className="mobile-scrim"
          onClick={onToggle}
          aria-label={t("closeMenu")}
        />
      )}
    </>
  );
}
