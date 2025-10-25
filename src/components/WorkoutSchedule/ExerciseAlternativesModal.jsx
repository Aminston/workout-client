import React, { useEffect } from "react";

const getAlternativeId = (alt, fallback) => {
  if (!alt || typeof alt !== "object") return fallback ?? null;
  return (
    alt.schedule_id ??
    alt.scheduleId ??
    alt.workout_id ??
    alt.workoutId ??
    alt.id ??
    fallback ?? null
  );
};

const formatLabel = (label) =>
  label && typeof label === "string"
    ? label.charAt(0).toUpperCase() + label.slice(1)
    : label;

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

  if (!open) return null;

  const renderBody = () => {
    if (status?.state === "loading") {
      return (
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          Cargando alternativas...
        </div>
      );
    }

    if (status?.state === "error") {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {status?.message || "No se pudieron cargar las alternativas."}
        </div>
      );
    }

    if (!alternatives?.length) {
      return (
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 px-4 py-3 text-sm text-gray-400">
          {status?.message || "No encontramos alternativas para este ejercicio."}
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {alternatives.map((alt, index) => {
          const altId = getAlternativeId(alt, `${index}`);
          const isSelected =
            selectedAlternativeId != null && String(selectedAlternativeId) === String(altId);
          const targetUrl = alt?.name
            ? `https://www.google.com/search?q=${encodeURIComponent(alt.name)}`
            : undefined;

          return (
            <button
              key={altId}
              type="button"
              onClick={() => onSelect?.(altId, alt)}
              className={[
                "group flex h-full flex-col rounded-2xl border bg-gray-800/70 p-5 text-left transition-all",
                "hover:border-blue-400/70 hover:bg-gray-800",
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-500/60"
                  : "border-gray-700",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-white">
                    {alt?.name || "Ejercicio alternativo"}
                  </h4>
                  {alt?.description && (
                    <p className="mt-1 text-sm text-gray-400">{alt.description}</p>
                  )}
                </div>
                {targetUrl && (
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 transition hover:border-blue-400/60 hover:bg-blue-500/20"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Ver en Google
                  </a>
                )}
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-300">
                {alt?.primary_muscle || alt?.primaryMuscle ? (
                  <div className="rounded-lg bg-gray-900/40 p-3">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Músculo principal</dt>
                    <dd className="mt-1 font-medium text-gray-200">
                      {formatLabel(alt?.primary_muscle ?? alt?.primaryMuscle)}
                    </dd>
                  </div>
                ) : null}
                {alt?.movement_pattern || alt?.movementPattern ? (
                  <div className="rounded-lg bg-gray-900/40 p-3">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Patrón de movimiento</dt>
                    <dd className="mt-1 font-medium text-gray-200">
                      {formatLabel(alt?.movement_pattern ?? alt?.movementPattern)}
                    </dd>
                  </div>
                ) : null}
                {alt?.difficulty ? (
                  <div className="rounded-lg bg-gray-900/40 p-3">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Dificultad</dt>
                    <dd className="mt-1 font-medium text-gray-200">{formatLabel(alt.difficulty)}</dd>
                  </div>
                ) : null}
                {alt?.equipment_needed || alt?.equipment ? (
                  <div className="rounded-lg bg-gray-900/40 p-3">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Equipo</dt>
                    <dd className="mt-1 font-medium text-gray-200">
                      {formatLabel(alt?.equipment_needed ?? alt?.equipment ?? "Sin equipo")}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-gray-700 bg-gray-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-alternatives-title"
      >
        <div className="border-b border-gray-800 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Alternativas</p>
              <h2 id="exercise-alternatives-title" className="mt-2 text-2xl font-bold text-white">
                {exerciseName ? `Reemplazar "${exerciseName}"` : "Elige una alternativa"}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Selecciona una alternativa y confirma para reemplazar tu ejercicio.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-gray-800/60 text-gray-300 transition hover:border-gray-500 hover:text-white"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          {renderBody()}
        </div>

        <div className="border-t border-gray-800 bg-gray-900/80 px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-full border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:text-white sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm?.(selectedAlternativeId)}
              disabled={!selectedAlternativeId || status?.state === "loading"}
              className={[
                "inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition sm:w-auto",
                selectedAlternativeId && status?.state !== "loading"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400"
                  : "cursor-not-allowed bg-gray-700 text-gray-400",
              ].join(" ")}
            >
              Confirmar reemplazo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

