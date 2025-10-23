import React, { useEffect, useMemo, useRef } from "react";
import "./WorkoutDetailView.css";

const resolveDetailData = (raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  if (raw.data && typeof raw.data === "object") return resolveDetailData(raw.data);
  if (raw.exercise && typeof raw.exercise === "object") return resolveDetailData(raw.exercise);
  return raw;
};

const extractUrlFromValue = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractUrlFromValue(entry);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value === "object") {
    return (
      extractUrlFromValue(
        value.url ||
          value.image_url ||
          value.imageUrl ||
          value.src ||
          value.thumbnail ||
          value.preview ||
          value.path
      ) || null
    );
  }
  return null;
};

const coalesceText = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    } else if (Array.isArray(value)) {
      const flattened = value
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            return (
              coalesceText(
                item.text,
                item.label,
                item.name,
                item.title,
                item.value
              ) || ""
            );
          }
          return "";
        })
        .filter(Boolean);
      if (flattened.length) return flattened.join(", ");
    } else if (typeof value === "object") {
      const nested = coalesceText(
        value.text,
        value.description,
        value.label,
        value.name,
        value.title,
        value.value
      );
      if (nested) return nested;
    }
  }
  return null;
};

const extractInstructionItems = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          return (
            coalesceText(
              item.text,
              item.description,
              item.step,
              item.label,
              item.title
            ) || ""
          );
        }
        return "";
      })
      .filter(Boolean);
    if (cleaned.length) return cleaned;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\r?\n/g, "\n").trim();
    const numberedSteps = normalized.match(
      /\d+[.)]\s*[\s\S]+?(?=(?:\s*\d+[.)]\s)|$)/g
    );
    if (numberedSteps && numberedSteps.length > 0) {
      return numberedSteps.map((step) => step.trim());
    }

    const pieces = normalized
      .split(/\n|\u2022|\u25CF|;|•|·|\s{2,}/)
      .map((piece) => piece.trim())
      .filter(Boolean);
    if (pieces.length) return pieces;
    return [normalized].filter(Boolean);
  }

  if (typeof value === "object") {
    return extractInstructionItems(
      value.steps ||
        value.instructions ||
        value.directions ||
        value.items ||
        value.list ||
        value.how_to ||
        value.howTo
    );
  }

  return [];
};

const normalizeLabel = (text) => {
  if (!text || typeof text !== "string") return text;
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const needsNormalization = /[_-]/.test(trimmed) || trimmed === trimmed.toLowerCase();
  if (!needsNormalization) return trimmed;
  return trimmed
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((segment) =>
          segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : ""
        )
        .join("-")
    )
    .join(" ");
};

const cleanInstruction = (step) => {
  if (typeof step !== "string") return "";
  const normalized = step.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.replace(/^\d+[.)]\s*/, "").trim();
};

const pickHeroImage = (detailData, exercise) => {
  const candidates = [
    detailData.hero_image,
    detailData.heroImage,
    detailData.primary_image,
    detailData.primaryImage,
    detailData.cover_image,
    detailData.coverImage,
    detailData.image_url,
    detailData.imageUrl,
    detailData.image,
    detailData.thumbnail,
    detailData.preview_image,
    detailData.previewImage,
    detailData.video_thumbnail,
    detailData.gif_url,
    detailData.media,
    detailData.images,
    exercise?.image_url,
    exercise?.image,
  ];

  for (const candidate of candidates) {
    const resolved = extractUrlFromValue(candidate);
    if (resolved) return resolved;
  }

  return null;
};

const hasContent = (value) =>
  typeof value === "string"
    ? value.trim().length > 0
    : Array.isArray(value)
    ? value.length > 0
    : !!value;

export default function ExerciseDetailModal({
  open,
  onClose,
  exercise,
  details,
  status,
  onGoogleSearch,
  onRetry,
}) {
  const dialogRef = useRef(null);
  const detailData = useMemo(() => resolveDetailData(details), [details]);
  const exerciseNameRaw = useMemo(
    () => exercise?.name || coalesceText(detailData.name) || "Exercise",
    [detailData, exercise]
  );
  const exerciseName = useMemo(
    () => normalizeLabel(exerciseNameRaw) || "Exercise",
    [exerciseNameRaw]
  );
  const heroImage = useMemo(() => pickHeroImage(detailData, exercise), [detailData, exercise]);
  const subtitle = useMemo(
    () =>
      coalesceText(
        detailData.subtitle,
        detailData.short_description,
        detailData.shortDescription,
        detailData.tagline,
        detailData.intro,
        detailData.summary,
        exercise?.summary,
        exercise?.short_description
      ),
    [detailData, exercise]
  );
  const primaryMuscles = useMemo(() => {
    const value = coalesceText(
      detailData.primary_muscles,
      detailData.primaryMuscle,
      detailData.primaryMuscleGroup,
      detailData.primaryMuscles,
      detailData.target_muscle,
      detailData.targetMuscle,
      detailData.target,
      detailData.muscle_group,
      detailData.muscleGroup,
      exercise?.primary_muscles,
      exercise?.primaryMuscle
    );
    return normalizeLabel(value) || value;
  }, [detailData, exercise]);

  const secondaryMuscles = useMemo(() => {
    const value = coalesceText(
      detailData.secondary_muscles,
      detailData.secondaryMuscle,
      detailData.secondaryMuscles,
      detailData.assisting_muscles,
      detailData.synergists,
      exercise?.secondary_muscles
    );
    return normalizeLabel(value) || value;
  }, [detailData, exercise]);

  const equipment = useMemo(() => {
    const value = coalesceText(
      detailData.equipment_needed,
      detailData.equipment,
      detailData.equipmentRequired,
      detailData.equipmentType,
      detailData.equipment_name,
      detailData.equipmentName,
      exercise?.equipment
    );
    return normalizeLabel(value) || value;
  }, [detailData, exercise]);

  const workoutType = useMemo(() => {
    const value = coalesceText(
      detailData.type,
      detailData.exercise_type,
      detailData.exerciseType,
      detailData.category_type,
      exercise?.type
    );
    return normalizeLabel(value) || value;
  }, [detailData, exercise]);

  const difficulty = useMemo(() => {
    const value = coalesceText(
      detailData.difficulty,
      detailData.difficulty_level,
      detailData.level,
      detailData.skill_level,
      detailData.intensity
    );
    return normalizeLabel(value) || value;
  }, [detailData]);

  const category = useMemo(() => {
    const value = coalesceText(
      detailData.category,
      detailData.exercise_category,
      detailData.body_part,
      detailData.bodyPart,
      detailData.focus,
      exercise?.category
    );
    return normalizeLabel(value) || value;
  }, [detailData, exercise]);

  const movementPattern = useMemo(() => {
    const value = coalesceText(
      detailData.movement_pattern,
      detailData.movementPattern,
      detailData.movement,
      detailData.mechanic,
      detailData.motion
    );
    return normalizeLabel(value) || value;
  }, [detailData]);
  const description = useMemo(
    () =>
      coalesceText(
        detailData.description,
        detailData.long_description,
        detailData.overview,
        detailData.tips,
        detailData.benefits,
        exercise?.description
      ),
    [detailData, exercise]
  );
  const instructions = useMemo(() => {
    const rawInstructions = extractInstructionItems(
      detailData.instructions ||
        detailData.steps ||
        detailData.directions ||
        detailData.how_to ||
        detailData.howTo ||
        detailData.guide ||
        exercise?.instructions
    );

    const cleaned = rawInstructions
      .map((step) => cleanInstruction(step))
      .filter(Boolean);

    if (cleaned.length === 0) return [];

    return Array.from(new Set(cleaned));
  }, [detailData, exercise]);

  const infoPairs = useMemo(() => {
    const entries = [
      { label: "Primary Muscles", value: primaryMuscles },
      { label: "Secondary Muscles", value: secondaryMuscles },
      { label: "Category", value: category },
      { label: "Movement Pattern", value: movementPattern },
      { label: "Equipment", value: equipment },
    ];

    return entries.filter((entry) => hasContent(entry.value));
  }, [primaryMuscles, secondaryMuscles, category, movementPattern, equipment]);

  const badges = useMemo(() => {
    const list = [];
    if (hasContent(difficulty)) {
      list.push({ key: "difficulty", label: difficulty, variant: "accent" });
    }
    if (hasContent(equipment)) {
      list.push({ key: "equipment", label: equipment, variant: "outline" });
    }
    if (hasContent(workoutType)) {
      list.push({ key: "type", label: workoutType, variant: "outline" });
    }
    return list;
  }, [difficulty, equipment, workoutType]);

  const statusState = status?.state || "idle";
  const statusMessage = status?.message || "";
  const hasRemoteDetails = details && Object.keys(detailData).length > 0;
  const showInitialSpinner = statusState === "loading" && !hasRemoteDetails;

  const headingId = useMemo(() => `exercise-detail-title-${exercise?.id ?? "generic"}`, [exercise?.id]);
  const descriptionId = description ? `${headingId}-desc` : undefined;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (dialogRef.current) {
      dialogRef.current.focus({ preventScroll: true });
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const handleTitleClick = () => {
    if (onGoogleSearch) {
      onGoogleSearch(exerciseName);
    }
  };

  return (
    <div className="exercise-detail-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="exercise-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <button
          type="button"
          className="exercise-detail-modal__close"
          onClick={onClose}
          aria-label="Close exercise details"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="exercise-modal-body">
          {showInitialSpinner ? (
            <div className="exercise-modal-loading">
              <div className="spinner-border text-primary" role="status" />
              <span>Loading exercise details...</span>
            </div>
          ) : (
            <div className="exercise-modal-content">
              {heroImage && (
                <div className="exercise-modal-hero" role="presentation">
                  <img
                    src={heroImage}
                    alt=""
                    className="exercise-modal-hero__image"
                  />
                </div>
              )}

              <header className="exercise-modal-header">
                <div className="exercise-modal-heading">
                  {hasContent(category) && (
                    <span className="exercise-modal-header__eyebrow">{category}</span>
                  )}
                  <button
                    type="button"
                    className="exercise-modal-title"
                    onClick={handleTitleClick}
                    title="Search for tutorials on Google"
                  >
                    <span>{exerciseName}</span>
                    <span aria-hidden="true" className="exercise-modal-title__icon">
                      ↗
                    </span>
                  </button>
                  {hasContent(subtitle) && (
                    <p className="exercise-modal-subtitle">{subtitle}</p>
                  )}
                  {!hasContent(subtitle) && hasContent(primaryMuscles) && (
                    <p className="exercise-modal-subtitle">{primaryMuscles}</p>
                  )}
                  {hasContent(description) && (
                    <p
                      className="exercise-modal-description exercise-modal-description--inline"
                      id={descriptionId}
                    >
                      {description}
                    </p>
                  )}
                </div>
              </header>

              {statusState === "error" && (
                <div className="exercise-modal-section exercise-modal-section--status">
                  <div className="exercise-modal-error">
                    <p>{statusMessage || "We couldn't load more information for this exercise."}</p>
                    {onRetry && (
                      <button type="button" className="btn btn-secondary" onClick={onRetry}>
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              )}

              {badges.length > 0 && (
                <div className="exercise-modal-section exercise-modal-section--tags">
                  <div className="exercise-modal-badges">
                    {badges.map((badge) => (
                      <span
                        key={badge.key}
                        className={`exercise-modal-badge exercise-modal-badge--${badge.variant}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {infoPairs.length > 0 && (
                <div className="exercise-modal-section">
                  <div className="exercise-modal-info-grid">
                    {infoPairs.map((item) => (
                      <div key={item.label} className="exercise-modal-info">
                        <span className="exercise-modal-info__label">{item.label}</span>
                        <span className="exercise-modal-info__value">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {instructions.length > 0 && (
                <div className="exercise-modal-section">
                  <h3 className="exercise-modal-section__title">Instructions</h3>
                  <ol className="exercise-modal-instructions">
                    {instructions.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {!hasContent(description) &&
                infoPairs.length === 0 &&
                instructions.length === 0 && (
                  <div className="exercise-modal-section">
                    <p className="exercise-modal-empty">
                      Detailed information is not available for this exercise yet.
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
