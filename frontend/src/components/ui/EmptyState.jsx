import React from "react";
import { Icon } from "../../icons";

export default function EmptyState({ onAdd, t }) {
  return (
    <div className="center-state empty-state">
      <span className="empty-cube">
        <Icon name="cube" size={46} />
      </span>
      <h1>{t("emptyTitle")}</h1>
      <p>{t("emptyBody")}</p>
      <button className="button primary" onClick={onAdd}>
        <Icon name="plus" />
        {t("addModel")}
      </button>
    </div>
  );
}
