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
      time: formatTime(remainingSeconds),
      isElapsed: false,
      showIcon: true,
      overSeconds,
    };
  }

  return {
    time: formatTime(overSeconds),
    isElapsed: true,
    showIcon: false,
    overSeconds,
  };
};
