import React, { useEffect, useMemo, useRef } from "react";
import "./WorkoutDetailView.css";

const getAlternativeId = (alt, fallback) => {
  if (!alt || typeof alt !== "object") return fallback ?? null;
  return (
    alt.workout_id ??
    alt.workoutId ??
    alt.schedule_id ??
    alt.scheduleId ??
    alt.id ??
    fallback ?? null
  );
};

const formatLabel = (label) => {
  if (!label || typeof label !== "string") return label;
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const buildMetadata = (alternative) => {
  if (!alternative || typeof alternative !== "object") return [];

  const items = [
    {
      label: "Músculo principal",
      value: alternative.primary_muscle ?? alternative.primaryMuscle ?? null,
    },
    {
      label: "Patrón de movimiento",
      value: alternative.movement_pattern ?? alternative.movementPattern ?? null,
    },
    {
      label: "Dificultad",
      value: alternative.difficulty ?? null,
    },
    {
      label: "Equipo",
      value:
        alternative.equipment_needed ?? alternative.equipment ?? "Sin equipo",
    },
  ];

  return items
    .map((item) => ({
      ...item,
      value: typeof item.value === "string" ? formatLabel(item.value) : item.value,
    }))
    .filter((item) => item.value);
};

export default function ExerciseAlternativesModal({
  open,
  onClose,
  onConfirm,
  onSelect,
  selectedAlternativeId,
  alternatives,
  status,
  exerciseName,
}) {
  const closeButtonRef = useRef(null);
  const firstInteractiveRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const focusTarget = firstInteractiveRef.current || closeButtonRef.current;
      focusTarget?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, alternatives]);

  const selectionMap = useMemo(() => {
    if (!Array.isArray(alternatives)) return new Map();
    return new Map(
      alternatives.map((alt, index) => [
        getAlternativeId(alt, `${index}`),
        alt,
      ])
    );
  }, [alternatives]);

  if (!open) return null;

  const renderStatusBlock = (message, variant = "neutral") => (
    <div
      className={`exercise-modal-status exercise-modal-status--${variant}`}
      role={variant === "error" ? "alert" : undefined}
    >
      <p>{message}</p>
    </div>
  );

  const renderAlternatives = () => {
    if (status?.state === "loading") {
      return (
        <div className="exercise-modal-loading">
          <div className="spinner-border text-primary" role="status" />
          <span>Cargando alternativas...</span>
        </div>
      );
    }

    if (status?.state === "error") {
      return renderStatusBlock(
        status?.message || "No se pudieron cargar las alternativas.",
        "error"
      );
    }

    if (!alternatives?.length) {
      return renderStatusBlock(
        status?.message || "No encontramos alternativas para este ejercicio.",
        "neutral"
      );
    }

    return (
      <div
        className="exercise-alternatives-grid"
        role="radiogroup"
        aria-label="Alternativas de ejercicio"
      >
        {alternatives.map((alternative, index) => {
          const altId = getAlternativeId(alternative, `${index}`);
          const isSelected =
            selectedAlternativeId != null &&
            String(selectedAlternativeId) === String(altId);
          const targetUrl = alternative?.name
            ? `https://www.google.com/search?q=${encodeURIComponent(
                alternative.name
              )}`
            : undefined;
          const metadata = buildMetadata(alternative);

          return (
            <button
              key={altId}
              type="button"
              ref={index === 0 ? firstInteractiveRef : null}
              role="radio"
              aria-checked={isSelected}
              className={`exercise-alternative-card${
                isSelected ? " exercise-alternative-card--selected" : ""
              }`}
              onClick={() => onSelect?.(altId, alternative)}
            >
              <div className="exercise-alternative-card__header">
                <div className="exercise-alternative-card__heading">
                  <h4 className="exercise-alternative-card__title">
                    {alternative?.name || "Ejercicio alternativo"}
                  </h4>
                  {alternative?.description && (
                    <p className="exercise-alternative-card__description">
                      {alternative.description}
                    </p>
                  )}
                </div>
                {targetUrl && (
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="exercise-alternative-card__link"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Ver en Google
                  </a>
                )}
              </div>

              {metadata.length > 0 && (
                <dl className="exercise-alternative-card__meta">
                  {metadata.map((item) => (
                    <div key={item.label} className="exercise-alternative-card__meta-item">
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const isConfirmDisabled =
    !selectedAlternativeId || status?.state === "loading";

  return (
    <div className="exercise-detail-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="exercise-detail-modal exercise-alternatives-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-alternatives-title"
      >
        <button
          type="button"
          className="exercise-detail-modal__close"
          onClick={onClose}
          aria-label="Cerrar"
          ref={closeButtonRef}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="exercise-modal-body">
          <div className="exercise-modal-content">
            <header className="exercise-modal-header">
              <div className="exercise-modal-heading">
                <span className="exercise-modal-header__eyebrow">Alternativas</span>
                <h2 id="exercise-alternatives-title" className="exercise-modal-title exercise-modal-title--static">
                  {exerciseName ? `Reemplazar "${exerciseName}"` : "Elige una alternativa"}
                </h2>
                <p className="exercise-modal-subtitle">
                  Selecciona una opción compatible para reemplazar tu ejercicio.
                </p>
              </div>
            </header>

            <section className="exercise-modal-section exercise-modal-section--alternatives">
              {renderAlternatives()}
            </section>
          </div>
        </div>

        <footer className="exercise-modal-footer">
          <div className="exercise-modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn--ghost"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="modal-btn modal-btn--primary"
              onClick={() => onConfirm?.(selectedAlternativeId, selectionMap.get(selectedAlternativeId))}
              disabled={isConfirmDisabled}
            >
              Confirmar reemplazo
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

