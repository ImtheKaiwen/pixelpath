import React from "react";

export default function SplashScreen({ visible }) {
  if (!visible) return null;
  return (
    <div className="splash" aria-label="Kaiwen başlatılıyor">
      <div className="splash-wordmark">
        kaiwen<span>corp</span>
      </div>
      <div className="splash-line">
        <i />
      </div>
    </div>
  );
}
