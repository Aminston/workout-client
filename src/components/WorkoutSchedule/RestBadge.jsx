import React, { useMemo } from "react";
import { FiClock } from "react-icons/fi";
import "./RestBadge.css";
import { computeRestBadgeView } from "./RestBadge.utils";

export default function RestBadge({
  remainingSeconds,
  elapsedSeconds,
  startingSeconds,
  onDismiss,
}) {
  const { label, time, isElapsed } = useMemo(
    () =>
      computeRestBadgeView({
        remainingSeconds,
        elapsedSeconds,
        startingSeconds,
      }),
    [elapsedSeconds, remainingSeconds, startingSeconds]
  );

  const progress = useMemo(() => {
    if (!startingSeconds) return 0;
    const consumed = Math.min(startingSeconds, startingSeconds - remainingSeconds);
    return Math.max(0, Math.min(1, consumed / startingSeconds));
  }, [remainingSeconds, startingSeconds]);

  return (
    <div
      className={`rest-badge${isElapsed ? " rest-badge--elapsed" : ""}`}
      role="status"
      aria-live="polite"
      data-progress={progress}
    >
      <FiClock className="rest-badge__icon" aria-hidden="true" />
      <span className="rest-badge__label">{label}</span>
      <span className="rest-badge__time">{time}</span>
      {onDismiss ? (
        <button
          type="button"
          className="rest-badge__close"
          onClick={onDismiss}
          aria-label="Dismiss rest timer"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
