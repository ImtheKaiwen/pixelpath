import React, { useEffect, useState } from "react";
import { Icon } from "../../icons";

export default function UpdateCenter({ t, expanded }) {
  const [update, setUpdate] = useState({ state: "idle", percent: 0 });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const bridge = window.pixelpath?.updates;
    if (!bridge) return;
    bridge.getState().then(setUpdate);
    return bridge.subscribe(setUpdate);
  }, []);
  if (["idle", "checking", "not-available"].includes(update.state)) return null;
  const downloading = update.state === "downloading";
  const ready = update.state === "downloaded";
  const title = ready
    ? t("updateReady")
    : downloading
      ? t("updateDownloading")
      : update.state === "error"
        ? t("updateError")
        : t("updateAvailable");
  return (
    <div className={`sidebar-update ${open ? "open" : ""}`} role="status">
      <button
        className="update-trigger"
        onClick={() => setOpen((value) => !value)}
        data-tooltip={!expanded ? title : undefined}
        data-tooltip-placement="right"
        aria-expanded={open}
      >
        <span className="update-icon">
          <Icon name={ready ? "check" : "download"} size={17} />
          <i />
        </span>
        <span>
          <b>{title}</b>
          <small>
            {update.availableVersion ? `v${update.availableVersion}` : ""}
          </small>
        </span>
      </button>
      {open && (
        <aside className="update-popover">
          <header>
            <div>
              <b>{title}</b>
              <small>
                v{update.currentVersion || "—"} → v
                {update.availableVersion || "—"}
              </small>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Kapat">
              <Icon name="x" size={15} />
            </button>
          </header>
          {update.releaseNotes && <p>{update.releaseNotes}</p>}
          {downloading && (
            <>
              <div className="update-progress">
                <i style={{ width: `${update.percent || 0}%` }} />
              </div>
              <small>%{update.percent || 0}</small>
            </>
          )}
          {update.state === "available" && (
            <button
              className="button primary"
              onClick={() => window.pixelpath.updates.download()}
            >
              {t("downloadUpdate")}
            </button>
          )}
          {ready && (
            <button
              className="button primary"
              onClick={() => {
                if (window.confirm(t("restartConfirm")))
                  window.pixelpath.updates.install();
              }}
            >
              {t("restartUpdate")}
            </button>
          )}
          {update.state === "error" && (
            <>
              <p className="update-error">{update.message}</p>
              <button
                className="button secondary"
                onClick={() => window.pixelpath.updates.check()}
              >
                {t("retry")}
              </button>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
