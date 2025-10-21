import React, { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./RestTimerBubble.css";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function RestTimerBubble({
  seconds,
  startingSeconds,
  onAdjust,
  onClose,
}) {
  const [portalEl, setPortalEl] = useState(null);
  const subtitleId = useId();
  const titleId = useId();

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const el = document.createElement("div");
    el.className = "rest-timer-portal";
    document.body.appendChild(el);
    setPortalEl(el);

    return () => {
      document.body.removeChild(el);
      setPortalEl(null);
    };
  }, []);

  const displaySeconds = useMemo(
    () => Math.max(0, Math.round(seconds || 0)),
    [seconds]
  );
  const initial = useMemo(
    () => Math.max(1, Math.round(startingSeconds || 1)),
    [startingSeconds]
  );
  const remainingPercent = useMemo(
    () => clamp((displaySeconds / initial) * 100, 0, 100),
    [displaySeconds, initial]
  );

  if (!portalEl) return null;

  return createPortal(
    <div className="rest-timer-overlay" role="presentation">
      <div className="rest-timer-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="rest-timer-bubble"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
      >
        <div className="rest-timer-header">
          <span className="rest-timer-title" id={titleId} aria-live="polite">
            Descanso: {displaySeconds}s
          </span>
          <button
            type="button"
            className="rest-timer-close"
            onClick={onClose}
            aria-label="Cerrar temporizador de descanso"
          >
            ×
          </button>
        </div>

        <p className="rest-timer-subtitle" id={subtitleId}>
          Ajusta tu descanso antes de continuar.
        </p>

        <div className="rest-timer-controls" aria-label="Controles del temporizador de descanso">
          <button
            type="button"
            className="rest-timer-btn"
            onClick={() => onAdjust(-10)}
            aria-label="Reducir 10 segundos"
          >
            −10s
          </button>
          <button
            type="button"
            className="rest-timer-btn"
            onClick={() => onAdjust(10)}
            aria-label="Agregar 10 segundos"
          >
            +10s
          </button>
        </div>

        <div className="rest-timer-progress" role="presentation">
          <div
            className="rest-timer-progress-fill"
            style={{ "--rest-progress-scale": `${remainingPercent / 100}` }}
          />
        </div>
      </div>
    </div>,
    portalEl
  );
}
