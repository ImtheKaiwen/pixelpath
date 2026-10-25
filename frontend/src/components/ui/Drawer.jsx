import React, { useEffect } from "react";

export default function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="drawer-layer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="drawer-backdrop"
        aria-label="Kapat"
        onClick={onClose}
      />
      <aside className="drawer-panel">{children}</aside>
    </div>
  );
}
