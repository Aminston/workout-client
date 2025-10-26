import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./WorkoutDetailView.css";
import "./ExerciseAlternativesModal.css";

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

  const cleaned = trimmed.replace(/[_-]+/g, " ").replace(/\s+/g, " ");

  return cleaned
    .split(" ")
    .map((word) => {
      if (!word) return "";
      const isAcronym = word.length <= 4 && word === word.toUpperCase();
      if (isAcronym) return word;

      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
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
  isConfirming = false,
  confirmationStatus,
}) {
  const closeButtonRef = useRef(null);
  const firstInteractiveRef = useRef(null);
  const cardRefs = useRef([]);
  const scrollContainerRef = useRef(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

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

  const updateScrollFades = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScrollTop = scrollHeight - clientHeight;

    setShowTopFade(scrollTop > 4);
    setShowBottomFade(maxScrollTop > 0 && scrollTop < maxScrollTop - 4);
  }, []);

  useEffect(() => {
    if (!open) {
      setShowTopFade(false);
      setShowBottomFade(false);
      return undefined;
    }

    const raf = window.requestAnimationFrame(updateScrollFades);
    return () => window.cancelAnimationFrame(raf);
  }, [open, alternatives, status?.state, updateScrollFades]);

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
    firstInteractiveRef.current = null;
    cardRefs.current = [];

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

          const handleCardSelect = () => onSelect?.(altId, alternative);

          const totalCards = alternatives.length;

          const handleKeyDown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleCardSelect();
              return;
            }

            if (event.key === "ArrowDown" || event.key === "ArrowRight") {
              event.preventDefault();
              const nextIndex = (index + 1) % totalCards;
              const nextNode = cardRefs.current[nextIndex];
              nextNode?.focus();
              return;
            }

            if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
              event.preventDefault();
              const prevIndex = (index - 1 + totalCards) % totalCards;
              const prevNode = cardRefs.current[prevIndex];
              prevNode?.focus();
              return;
            }

            if (event.key === "Home") {
              event.preventDefault();
              cardRefs.current[0]?.focus();
              return;
            }

            if (event.key === "End") {
              event.preventDefault();
              cardRefs.current[totalCards - 1]?.focus();
            }
          };

          const cardClassName = `exercise-alternative-card${
            isSelected ? " exercise-alternative-card--selected" : ""
          }`;

          const tabIndex =
            selectedAlternativeId == null
              ? index === 0
                ? 0
                : -1
              : isSelected
              ? 0
              : -1;

          const ariaLabel = alternative?.name
            ? `Alternativa ${alternative.name}`
            : "Alternativa de ejercicio";

          const registerRef = (node) => {
            cardRefs.current[index] = node || null;
            if (index === 0) {
              firstInteractiveRef.current = node || null;
            }
          };

          return (
            <div
              key={altId}
              ref={registerRef}
              role="radio"
              tabIndex={tabIndex}
              aria-checked={isSelected}
              aria-label={ariaLabel}
              className={cardClassName}
              data-selected={isSelected ? "true" : undefined}
              onClick={handleCardSelect}
              onKeyDown={handleKeyDown}
            >
              <span
                className="exercise-alternative-card__check"
                aria-hidden="true"
              >
                ✓
              </span>
              <div className="exercise-alternative-card__content">
                <h4 className="exercise-alternative-card__title">
                  {targetUrl ? (
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="exercise-alternative-card__title-link"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {alternative?.name || "Ejercicio alternativo"}
                    </a>
                  ) : (
                    <span className="exercise-alternative-card__title-text">
                      {alternative?.name || "Ejercicio alternativo"}
                    </span>
                  )}
                </h4>
                {alternative?.description && (
                  <p className="exercise-alternative-card__description">
                    {alternative.description}
                  </p>
                )}

                {metadata.length > 0 && (
                  <dl className="exercise-alternative-card__meta">
                    {metadata.map((item) => (
                      <div
                        key={item.label}
                        className="exercise-alternative-card__meta-item"
                      >
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
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
    selectedAlternativeId == null ||
    status?.state === "loading" ||
    isConfirming;

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

        <header className="exercise-modal-header">
          <div className="exercise-modal-heading">
            <span className="exercise-modal-header__eyebrow">Alternativas</span>
            <h2
              id="exercise-alternatives-title"
              className="exercise-modal-title exercise-modal-title--static"
            >
              {exerciseName ? `Reemplazar "${exerciseName}"` : "Elige una alternativa"}
            </h2>
            <p className="exercise-modal-subtitle">
              Selecciona una opción compatible para reemplazar tu ejercicio.
            </p>
          </div>
        </header>

        <div className="exercise-modal-body exercise-alternatives-body">
          <div
            className={`exercise-alternatives-fade exercise-alternatives-fade--top${
              showTopFade ? " is-visible" : ""
            }`}
            aria-hidden="true"
          />
          <div
            ref={scrollContainerRef}
            className="exercise-alternatives-scroll"
            onScroll={updateScrollFades}
          >
            {confirmationStatus?.state === "error" && (
              <div className="exercise-modal-inline-status">
                <div
                  className="exercise-modal-status exercise-modal-status--error"
                  role="alert"
                >
                  <p>
                    {confirmationStatus?.message ||
                      "No se pudo reemplazar el ejercicio."}
                  </p>
                </div>
              </div>
            )}
            {renderAlternatives()}
          </div>
          <div
            className={`exercise-alternatives-fade exercise-alternatives-fade--bottom${
              showBottomFade ? " is-visible" : ""
            }`}
            aria-hidden="true"
          />
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
              onClick={() =>
                onConfirm?.(
                  selectedAlternativeId,
                  selectionMap.get(selectedAlternativeId)
                )
              }
              disabled={isConfirmDisabled}
              aria-busy={isConfirming ? "true" : undefined}
            >
              {isConfirming ? "Reemplazando..." : "Confirmar reemplazo"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

