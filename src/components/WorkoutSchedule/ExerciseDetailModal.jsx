import React, { useEffect, useMemo } from "react";

const toList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n\r,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const toInstructions = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n\r]+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
};

export default function ExerciseDetailModal({
  open,
  onClose,
  exercise,
  details,
  status,
  onGoogleSearch,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !exercise) return null;

  const { loading = false, error = null } = status || {};
  const heroImage =
    details?.image_url ||
    details?.imageUrl ||
    details?.image ||
    (Array.isArray(details?.media) ? details.media[0] : null);
  const difficulty = details?.difficulty || exercise.difficulty || null;
  const equipment = toList(details?.equipment || exercise.equipment);
  const workoutType = exercise.type || details?.type || null;
  const primaryMuscles = toList(
    details?.muscles?.primary || details?.primary_muscles || details?.primaryMuscles
  );
  const secondaryMuscles = toList(
    details?.muscles?.secondary || details?.secondary_muscles || details?.secondaryMuscles
  );
  const description =
    details?.description || details?.summary || details?.overview || exercise.description;
  const instructions = toInstructions(details?.instructions || details?.steps);
  const titleId = useMemo(
    () => `exercise-detail-title-${exercise.id}`,
    [exercise.id]
  );
  const heroStyle = heroImage
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(8, 10, 14, 0.1) 0%, rgba(8, 10, 14, 0.75) 100%), url(${heroImage})`,
      }
    : undefined;

  return (
    <div
      className="exercise-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => onClose?.()}
    >
      <div className="exercise-detail-modal" role="document" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="exercise-detail-close"
          aria-label="Close exercise details"
          onClick={() => onClose?.()}
        >
          ×
        </button>
        <div
          className={`exercise-detail-hero ${heroImage ? "with-image" : ""}`}
          style={heroStyle}
        >
          <div className="exercise-detail-hero-content">
            <button
              type="button"
              id={titleId}
              className="exercise-detail-title-button"
              onClick={() => {
                if (onGoogleSearch && exercise?.name) {
                  onGoogleSearch(exercise.name);
                }
              }}
            >
              {exercise.name}
            </button>
            <div className="exercise-detail-badges">
              {difficulty && <span className="exercise-detail-badge">{difficulty}</span>}
              {workoutType && <span className="exercise-detail-badge">{workoutType}</span>}
              {equipment.length > 0 && (
                <span className="exercise-detail-badge">{equipment.join(", ")}</span>
              )}
            </div>
          </div>
        </div>
        <div className="exercise-detail-body">
          {loading && (
            <div className="exercise-detail-status">Loading exercise details...</div>
          )}
          {!loading && error && (
            <div className="exercise-detail-status error">{error}</div>
          )}
          {!loading && !error && (
            <>
              {description && (
                <section className="exercise-detail-section">
                  <h4>Overview</h4>
                  <p>{description}</p>
                </section>
              )}
              {(primaryMuscles.length > 0 || secondaryMuscles.length > 0) && (
                <section className="exercise-detail-section">
                  <h4>Muscle Groups</h4>
                  <div className="exercise-detail-muscles">
                    {primaryMuscles.length > 0 && (
                      <div className="exercise-detail-muscle-group">
                        <span className="label">Primary</span>
                        <ul>
                          {primaryMuscles.map((item) => (
                            <li key={`primary-${item}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {secondaryMuscles.length > 0 && (
                      <div className="exercise-detail-muscle-group">
                        <span className="label">Secondary</span>
                        <ul>
                          {secondaryMuscles.map((item) => (
                            <li key={`secondary-${item}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}
              {instructions.length > 0 && (
                <section className="exercise-detail-section">
                  <h4>Instructions</h4>
                  <ol className="exercise-detail-instructions">
                    {instructions.map((step, index) => (
                      <li key={`instruction-${index}`}>{step}</li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
