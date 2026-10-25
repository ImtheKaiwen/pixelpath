import React from "react";
import { Icon } from "../../icons";
import TabSwitch from "../ui/TabSwitch";

export default function Topbar({
  model,
  tab,
  onTab,
  guideOpen,
  onGuide,
  onSettings,
  onMenu,
  t,
}) {
  return (
    <header className="topbar">
      <div className="top-left">
        <button className="mobile-menu" onClick={onMenu} aria-label="Menü">
          <Icon name="menu" size={18} />
        </button>
        <span className="crumb">{t("projects")}</span>
        <span className="slash">/</span>
        <strong>{model?.name || "Kütüphane"}</strong>
      </div>
      <div className="top-actions">
        {model && (
          <TabSwitch
            className="view-switcher"
            value={tab}
            onChange={onTab}
            label={t("view")}
            options={[
              { value: "build", label: "3D", icon: "cube" },
              { value: "materials", label: t("materials"), icon: "list" },
            ]}
          />
        )}
        {model && tab === "build" && (
          <button
            className={`button ghost guide-toggle ${guideOpen ? "active" : ""}`}
            onClick={onGuide}
          >
            <Icon name="layers" size={16} />
            <span>{t("assembly")}</span>
          </button>
        )}
        {model && (
          <button className="button ghost settings-button" onClick={onSettings}>
            <Icon name="settings" size={16} />
            <span>{t("settings")}</span>
          </button>
        )}
      </div>
    </header>
  );
}
