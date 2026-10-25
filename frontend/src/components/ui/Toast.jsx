import React, { useEffect, useState } from "react";
import { Icon } from "../../icons";

export default function Toast({ message, onClose }) {
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!message) return;
    setClosing(false);
    const exitTimer = window.setTimeout(() => setClosing(true), 1700);
    const closeTimer = window.setTimeout(onClose, 2000);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(closeTimer);
    };
  }, [message]);
  if (!message) return null;
  return (
    <button
      className={`toast ${closing ? "closing" : ""}`}
      onClick={onClose}
      role="status"
    >
      <Icon name="check" size={15} />
      <span>{message}</span>
    </button>
  );
}
