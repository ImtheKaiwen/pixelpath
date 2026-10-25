import React, { useEffect, useState } from "react";
import { Icon } from "../../icons";

export default function UpdateCenter({ t }) {
  const [update, setUpdate] = useState({ state: "idle", percent: 0 });
  useEffect(() => {
    const bridge = window.pixelpath?.updates;
    if (!bridge) return;
    bridge.getState().then(setUpdate);
    return bridge.subscribe(setUpdate);
  }, []);
  useEffect(() => {
    if (update.state !== "error") return undefined;
    const timer = window.setTimeout(
      () => setUpdate({ state: "idle", percent: 0 }),
      3600,
    );
    return () => window.clearTimeout(timer);
  }, [update.state]);
  if (["idle", "not-available"].includes(update.state)) return null;
  const downloading = update.state === "downloading";
  const ready = update.state === "downloaded";
  return (
    <aside className="update-center" role="status">
      <span className="update-icon">
        <Icon name={ready ? "check" : "download"} size={18} />
      </span>
      <div>
        <b>
          {ready
            ? t("updateReady")
            : downloading
              ? t("updateDownloading")
              : update.state === "error"
                ? t("updateError")
                : t("updateChecking")}
        </b>
        <small>{update.version ? `PixelPath ${update.version}` : ""}</small>
        {downloading && (
          <div className="update-progress">
            <i style={{ width: `${update.percent || 0}%` }} />
          </div>
        )}
      </div>
      {ready && (
        <button onClick={() => window.pixelpath.updates.install()}>
          {t("restartUpdate")}
        </button>
      )}
    </aside>
  );
}
