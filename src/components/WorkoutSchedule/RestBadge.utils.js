export const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds ?? 0));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
};

export const computeRestBadgeView = ({
  remainingSeconds,
  elapsedSeconds,
  startingSeconds,
}) => {
  const overSeconds = Math.max(0, (elapsedSeconds ?? 0) - (startingSeconds ?? 0));

  if (remainingSeconds > 0) {
    return {
      label: "Rest",
      time: formatTime(remainingSeconds),
      isElapsed: false,
      overSeconds,
    };
  }

  return {
    label: "Rest elapsed",
    time: formatTime(overSeconds),
    isElapsed: true,
    overSeconds,
  };
};
