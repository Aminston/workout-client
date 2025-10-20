import React from "react";
import "./RestTimerBubble.css";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function RestTimerBubble({
  seconds,
  startingSeconds,
  onAdjust,
  onClose,
}) {
  const displaySeconds = Math.max(0, Math.round(seconds || 0));
  const initial = Math.max(1, Math.round(startingSeconds || 1));
  const progress = 100 - clamp((displaySeconds / initial) * 100, 0, 100);

  return (
    <div className="rest-timer-bubble" role="status" aria-live="polite">
      <div className="rest-timer-header">
        <span className="rest-timer-title">Descanso: {displaySeconds}s</span>
        <button
          type="button"
          className="rest-timer-close"
          onClick={onClose}
          aria-label="Cerrar temporizador de descanso"
        >
          ×
        </button>
      </div>

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
        <div className="rest-timer-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
