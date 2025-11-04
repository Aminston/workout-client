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
  const { time, showIcon } = useMemo(
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

  if (!showIcon) {
    return null;
  }

  return (
    <div className="rest-badge" role="status" aria-live="polite" data-progress={progress}>
      <FiClock className="rest-badge__icon" aria-hidden="true" />
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
