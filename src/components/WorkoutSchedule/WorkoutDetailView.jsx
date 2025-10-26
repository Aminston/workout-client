// src/components/WorkoutSchedule/WorkoutDetailView.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./WorkoutDetailView.css";
import { weightConverter } from "./workoutUtils";
import RestTimerBubble from "./RestTimerBubble";
import ExerciseDetailModal from "./ExerciseDetailModal";
import ExerciseAlternativesModal from "./ExerciseAlternativesModal";

/* ================== tiny helpers ================== */
const toIso = (s) => (typeof s === "string" ? s.replace(" ", "T") : s);
const nnum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const numOr = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);

/* ---- tolerant session field readers (backend varies slightly) ---- */
const isCompleted = (s) => {
  const v = s?.set_status ?? s?.status ?? s?.state ?? null;
  if (v == null) return false;
  if (typeof v === "number") return v === 1;
  const sv = String(v).toLowerCase();
  return sv === "completed" || sv === "done" || sv === "complete";
};
const getSetNumber = (s) =>
  Number(s.set_number ?? s.setNumber ?? s.set_index ?? s.setIndex ?? NaN);
const getCreatedAt = (s) =>
  s.created_at || s.createdAt || s.saved_at || s.savedAt || null;

/* ================== transform day -> exercises ================== */
/** Normalize raw sessions to a consistent shape; do NOT inject base fallbacks. */
function normalizeSessions(raw) {
  const sessions = Array.isArray(raw) ? raw : [];
  return sessions
    .map((s) => {
      const sn = getSetNumber(s);
      if (!Number.isInteger(sn) || sn < 1) return null;

      // normalize weight to object with value+unit if possible
      const weight =
        s.weight?.value != null
          ? { value: nnum(s.weight.value), unit: s.weight.unit || "kg" }
          : s.weight_value != null
          ? { value: nnum(s.weight_value), unit: s.weight_unit || "kg" }
          : s.weight || null;

      return {
        ...s,
        set_number: sn,
        created_at: getCreatedAt(s),
        weight,
        reps: nnum(s.reps),
        time: s.time || null,
      };
    })
    .filter(Boolean);
}

/**
 * Build exercises WITHOUT fabricating base reps/weight:
 * - total sets = provided base `sets` OR max set_number in sessions OR 0
 * - completed sets come from sessions only
 * - others are pending (0/0)
 */
function buildExercisesFromDay(dayData) {
  if (!dayData || !Array.isArray(dayData.workouts)) {
    throw new Error("Invalid workout data: missing workouts array.");
  }

  return dayData.workouts.map((w) => {
    const {
      scheduleId,
      workout_id,
      name,
      category,
      type,
      sets: baseSets, // may be null
      sessions: rawSessions,
    } = w;

    const sessions = normalizeSessions(rawSessions);

    // Determine total sets
    const maxSessionSet = sessions.reduce(
      (m, s) => Math.max(m, Number(s.set_number || 0)),
      0
    );
    const totalSets =
      Number.isInteger(baseSets) && baseSets > 0 ? baseSets : maxSessionSet;

    // Pick latest completed per set_number (created_at desc, then session_id)
    const latestBySet = {};
    for (const s of sessions) {
      const sn = s.set_number;
      const existing = latestBySet[sn];
      if (!existing) {
        latestBySet[sn] = s;
        continue;
      }
      const a = new Date(toIso(getCreatedAt(existing))).getTime() || 0;
      const b = new Date(toIso(getCreatedAt(s))).getTime() || 0;
      if (b > a) latestBySet[sn] = s;
      else if (b === a) {
        const ea = Number(existing.session_id ?? existing.sessionId ?? 0);
        const eb = Number(s.session_id ?? s.sessionId ?? 0);
        if (eb > ea) latestBySet[sn] = s;
      }
    }

    const sets = [];
    for (let i = 1; i <= totalSets; i++) {
      const s = latestBySet[i];
      if (s && isCompleted(s)) {
        const weightKg = weightConverter.normalize(s.weight);
        sets.push({
          id: i,
          reps: numOr(s.reps, 0),
          weight: numOr(weightKg, 0),
          weightUnit: s.weight?.unit || "kg",
          duration: s.elapsed_time != null ? Number(s.elapsed_time) : (s.time?.value ?? null),
          status: "done",
          completedAt: getCreatedAt(s),
          isFromSession: true,
          isSynced: true,
        });
      } else {
        // Pending - use program defaults (base reps & weight)
        const defaultWeight =
          w.weight?.value != null
            ? w.weight.value
            : w.weight_value != null
            ? w.weight_value
            : w.weight ?? 0;

        sets.push({
          id: i,
          reps: numOr(w.reps, 0),
          weight: numOr(defaultWeight, 0),
          weightUnit: w.weight?.unit || w.weight_unit || "kg",
          duration: null,
          status: "pending",
          completedAt: null,
          isFromSession: false,
          isSynced: false,
        });
      }
    }

    const done = sets.filter((x) => x.status === "done").length;
    const status =
      done === sets.length && sets.length > 0
        ? "done"
        : done > 0
        ? "in-progress"
        : "pending";

    return {
      id: scheduleId,
      scheduleId,
      workout_id,
      name,
      category,
      type,
      sets,
      status,
    };
  });
}

/* ================== API helpers ================== */
const getApiUrl = (endpoint) => {
  const base = import.meta.env.VITE_API_URL || "http://localhost:3000";
  return `${base}${endpoint}`;
};
const getAuthHeaders = () => {
  const token =
    localStorage.getItem("jwt_token") || localStorage.getItem("X-API-Token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/** Build the camelCase payload expected by /sessions/save */
function toApiSession(exercise, sets) {
  return {
    scheduleId: exercise.scheduleId,
    status: "completed",
    performedSets: sets.map((s) => {
      const out = {
        setNumber: s.id,
        weightUnit: s.weightUnit || "kg",
      };
      if (Number.isFinite(Number(s.reps))) out.reps = Number(s.reps);
      if (Number.isFinite(Number(s.weight))) out.weight = Number(s.weight);
      if (Number.isFinite(Number(s.duration))) out.elapsedTime = Number(s.duration);
      return out;
    }),
  };
}

/* ================== UI helpers ================== */
const fmtElapsed = (sec) => {
  if (sec == null) return "-";
  if (sec < 60) return sec % 1 === 0 ? `${sec}s` : `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

const DEFAULT_REST_SECONDS = 60;

const normalizeAlternativesResponse = (payload, identifiers = {}) => {
  if (!payload) return [];

  const { workoutId, scheduleId } = identifiers;
  const keyCandidates = [];
  if (workoutId != null) {
    keyCandidates.push(String(workoutId));
    keyCandidates.push(Number(workoutId));
  }
  if (scheduleId != null) {
    keyCandidates.push(String(scheduleId));
    keyCandidates.push(Number(scheduleId));
  }

  const tryExtract = (source) => {
    if (!source) return null;
    if (Array.isArray(source)) return source;
    if (typeof source !== "object") return null;

    for (const key of keyCandidates) {
      if (key != null && Array.isArray(source[key])) return source[key];
    }

    const values = Object.values(source).filter(Array.isArray);
    if (values.length > 0) return values[0];
    return null;
  };

  return (
    tryExtract(payload.alternatives) ||
    tryExtract(payload.data?.alternatives) ||
    tryExtract(payload.data) ||
    tryExtract(payload) ||
    []
  );
};

const SwapArrowsIcon = ({ className }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M7 7h11l-3.5-3.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 17H6l3.5 3.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ================== Component ================== */
export default function WorkoutDetailView() {
  const location = useLocation();
  const navigate = useNavigate();

  // state
  const [exercises, setExercises] = useState([]);
  const [workoutMeta, setWorkoutMeta] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [editing, setEditing] = useState(null); // {exerciseId,setId,field}
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restTimer, setRestTimer] = useState({
    isVisible: false,
    seconds: 0,
    startingSeconds: 0,
  });
  const [activeExercise, setActiveExercise] = useState(null);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [exerciseDetailsCache, setExerciseDetailsCache] = useState({});
  const [exerciseDetailStatus, setExerciseDetailStatus] = useState({
    state: "idle",
    message: "",
  });
  const [isAlternativesModalOpen, setIsAlternativesModalOpen] = useState(false);
  const [alternativesTargetExercise, setAlternativesTargetExercise] = useState(null);
  const [alternativesCache, setAlternativesCache] = useState({});
  const [alternativesStatus, setAlternativesStatus] = useState({
    state: "idle",
    message: "",
  });
  const [selectedAlternativeId, setSelectedAlternativeId] = useState(null);
  const [selectedAlternative, setSelectedAlternative] = useState(null);
  const [replacementRequest, setReplacementRequest] = useState({
    state: "idle",
    message: "",
  });
  const [replacementFeedback, setReplacementFeedback] = useState(null);

  const restIntervalRef = useRef(null);
  const inFlight = useRef(new Set()); // guard: `${exerciseId}-${setId}`
  const feedbackTimeoutRef = useRef(null);

  const clearReplacementFeedback = useCallback(() => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, []);

  const showReplacementFeedback = useCallback(
    (type, message, duration = 3000) => {
      clearReplacementFeedback();
      setReplacementFeedback({ type, message });
      if (duration != null) {
        feedbackTimeoutRef.current = setTimeout(() => {
          setReplacementFeedback(null);
          feedbackTimeoutRef.current = null;
        }, duration);
      }
    },
    [clearReplacementFeedback]
  );

  useEffect(() => () => clearReplacementFeedback(), [clearReplacementFeedback]);

  const clearRestInterval = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
  }, []);

  const activeWorkoutId = activeExercise?.workout_id ?? null;

  const fetchAlternativesForExercise = useCallback(
    async (exercise) => {
      const workoutId = exercise?.workout_id ?? exercise?.workoutId ?? null;
      const scheduleId = exercise?.scheduleId ?? exercise?.id ?? null;
      if (!workoutId) {
        setAlternativesStatus({
          state: "error",
          message: "No se pudo identificar el ejercicio para buscar alternativas.",
        });
        return;
      }

      setAlternativesStatus({ state: "loading", message: "" });

      try {
        const response = await fetch(
          getApiUrl(
            `/schedule/workouts/alternatives?ids=${encodeURIComponent(workoutId)}`
          ),
          {
            headers: getAuthHeaders(),
          }
        );

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            text || "No se pudieron cargar las alternativas del ejercicio."
          );
        }

        const payload = await response.json().catch(() => ({}));
        const normalized = normalizeAlternativesResponse(payload, {
          workoutId,
          scheduleId,
        });

        setAlternativesCache((prev) => ({
          ...prev,
          [workoutId]: Array.isArray(normalized) ? normalized : [],
        }));

        setAlternativesStatus({
          state: "success",
          message: normalized?.length
            ? ""
            : "No encontramos alternativas para este ejercicio.",
        });
      } catch (err) {
        setAlternativesStatus({
          state: "error",
          message:
            err?.message || "No se pudieron cargar las alternativas del ejercicio.",
        });
      }
    },
    []
  );

  const openAlternativesModal = useCallback(
    (exercise) => {
      if (!exercise) return;
      const workoutId = exercise.workout_id ?? exercise.workoutId ?? null;

      setAlternativesTargetExercise(exercise);
      setSelectedAlternativeId(null);
      setSelectedAlternative(null);
      setReplacementRequest({ state: "idle", message: "" });

      if (workoutId && Array.isArray(alternativesCache[workoutId])) {
        const cached = alternativesCache[workoutId];
        setAlternativesStatus({
          state: "success",
          message: cached.length
            ? ""
            : "No encontramos alternativas para este ejercicio.",
        });
      } else if (workoutId) {
        fetchAlternativesForExercise(exercise);
      } else {
        setAlternativesStatus({
          state: "error",
          message: "No se pudo identificar el ejercicio para buscar alternativas.",
        });
      }

      setIsAlternativesModalOpen(true);
    },
    [alternativesCache, fetchAlternativesForExercise]
  );

  const closeAlternativesModal = useCallback(() => {
    setIsAlternativesModalOpen(false);
    setAlternativesTargetExercise(null);
    setSelectedAlternativeId(null);
    setSelectedAlternative(null);
    setReplacementRequest({ state: "idle", message: "" });
    setAlternativesStatus({ state: "idle", message: "" });
  }, []);

  const handleSelectAlternative = useCallback((altId, alt) => {
    setSelectedAlternativeId(altId);
    setSelectedAlternative(alt);
  }, []);

  const performAlternativeReplacement = useCallback(
    async (exercise, alternative) => {
      if (!exercise || !alternative) {
        throw new Error("Selecciona un ejercicio y una alternativa válidos.");
      }

      const scheduleId = exercise?.scheduleId ?? exercise?.id ?? null;
      const newWorkoutId =
        alternative?.workout_id ??
        alternative?.workoutId ??
        alternative?.schedule_id ??
        alternative?.scheduleId ??
        alternative?.id ??
        null;

      if (!scheduleId) {
        throw new Error("No se pudo identificar el ejercicio a reemplazar.");
      }

      if (!newWorkoutId) {
        throw new Error("No se pudo identificar la alternativa seleccionada.");
      }

      const response = await fetch(
        getApiUrl(`/schedule/workout/replace/${encodeURIComponent(scheduleId)}`),
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ workout_id: newWorkoutId }),
        }
      );

      if (!response.ok) {
        const raw = await response.text().catch(() => "");
        let message = raw?.trim() || "No se pudo reemplazar el ejercicio.";
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            message =
              parsed?.message ||
              parsed?.error ||
              parsed?.details ||
              message;
          } catch (err) {
            // ignore json parse error
          }
        }

        if (!raw && response.status === 409) {
          message = "Ya iniciaste este ejercicio. No puede ser reemplazado.";
        }

        throw new Error(message);
      }

      const payload = await response.json().catch(() => ({}));
      const payloadWorkout =
        payload?.workout ?? payload?.data?.workout ?? payload?.data ?? null;

      const updatedWorkoutId =
        payloadWorkout?.workout_id ??
        payloadWorkout?.id ??
        payload?.workout_id ??
        payload?.workoutId ??
        newWorkoutId;

      const updatedName =
        payloadWorkout?.name ?? payload?.name ?? alternative?.name ?? exercise.name;

      const updatedCategory =
        payloadWorkout?.category ?? alternative?.category ?? exercise.category;

      const updatedType =
        payloadWorkout?.type ?? alternative?.type ?? exercise.type;

      setExercises((prev) =>
        prev.map((ex) =>
          ex.id !== scheduleId
            ? ex
            : {
                ...ex,
                name: updatedName,
                category: updatedCategory,
                type: updatedType,
                workout_id: updatedWorkoutId,
                workoutId: updatedWorkoutId,
              }
        )
      );
    },
    [setExercises]
  );

  const handleConfirmAlternative = useCallback(
    async (_alternativeId, alternativeFromModal) => {
      const alternative = alternativeFromModal ?? selectedAlternative;
      if (!alternativesTargetExercise || !alternative) return;
      setReplacementRequest({ state: "loading", message: "" });

      try {
        await performAlternativeReplacement(
          alternativesTargetExercise,
          alternative
        );
        setReplacementRequest({ state: "success", message: "" });
        closeAlternativesModal();
        showReplacementFeedback("success", "Ejercicio actualizado");
      } catch (error) {
        const message = error?.message || "No se pudo reemplazar el ejercicio.";
        setReplacementRequest({ state: "error", message });
      }
    },
    [
      alternativesTargetExercise,
      selectedAlternative,
      closeAlternativesModal,
      performAlternativeReplacement,
      showReplacementFeedback,
    ]
  );

  const openExerciseModal = useCallback(
    (exercise) => {
      if (!exercise) return;
      const workoutId = exercise.workout_id ?? null;
      setActiveExercise(exercise);
      if (workoutId && exerciseDetailsCache[workoutId]) {
        setExerciseDetailStatus({ state: "success", message: "" });
      } else if (workoutId) {
        setExerciseDetailStatus({ state: "loading", message: "" });
      } else {
        setExerciseDetailStatus({ state: "success", message: "" });
      }
      setIsExerciseModalOpen(true);
    },
    [exerciseDetailsCache]
  );

  const closeExerciseModal = useCallback(() => {
    setIsExerciseModalOpen(false);
    setActiveExercise(null);
    setExerciseDetailStatus({ state: "idle", message: "" });
  }, []);

  const handleGoogleSearch = useCallback((exerciseName) => {
    if (!exerciseName) return;
    const a = document.createElement("a");
    a.href = `https://www.google.com/search?q=how+to+${encodeURIComponent(
      exerciseName
    )}&tbm=vid`;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  }, []);

  const fetchExerciseDetails = useCallback(
    async (workoutId, force = false) => {
      if (!workoutId) return null;
      if (!force && exerciseDetailsCache[workoutId]) {
        setExerciseDetailStatus((prev) =>
          prev.state === "success" ? prev : { state: "success", message: "" }
        );
        return exerciseDetailsCache[workoutId];
      }

      setExerciseDetailStatus({ state: "loading", message: "" });

      try {
        const response = await fetch(getApiUrl(`/workouts/${workoutId}`), {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            text ? `Unable to load exercise details: ${text}` : "Unable to load exercise details"
          );
        }

        const payload = await response.json().catch(() => ({}));
        setExerciseDetailsCache((prev) => ({ ...prev, [workoutId]: payload }));
        setExerciseDetailStatus({ state: "success", message: "" });
        return payload;
      } catch (err) {
        setExerciseDetailStatus({
          state: "error",
          message: err?.message || "Failed to load exercise details",
        });
        return null;
      }
    },
    [exerciseDetailsCache]
  );

  const startRestTimer = useCallback(
    (initialSeconds = DEFAULT_REST_SECONDS) => {
      const normalized = Math.max(0, Math.round(initialSeconds));
      clearRestInterval();

      if (normalized <= 0) {
        setRestTimer({ isVisible: false, seconds: 0, startingSeconds: 0 });
        return;
      }

      setRestTimer({
        isVisible: true,
        seconds: normalized,
        startingSeconds: normalized,
      });

      restIntervalRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (!prev.isVisible) return prev;
          const nextSeconds = Math.max(0, prev.seconds - 1);
          if (nextSeconds <= 0) {
            clearRestInterval();
            return { isVisible: false, seconds: 0, startingSeconds: prev.startingSeconds };
          }
          return { ...prev, seconds: nextSeconds };
        });
      }, 1000);
    },
    [clearRestInterval]
  );

  const adjustRestTimer = useCallback(
    (delta) => {
      setRestTimer((prev) => {
        if (!prev.isVisible) return prev;
        const nextSeconds = Math.max(0, Math.round(prev.seconds + delta));
        if (nextSeconds <= 0) {
          clearRestInterval();
          return { isVisible: false, seconds: 0, startingSeconds: prev.startingSeconds };
        }
        const nextStarting = delta > 0 ? Math.max(prev.startingSeconds, nextSeconds) : prev.startingSeconds;
        return {
          ...prev,
          seconds: nextSeconds,
          startingSeconds: nextStarting,
        };
      });
    },
    [clearRestInterval]
  );

  const closeRestTimer = useCallback(() => {
    clearRestInterval();
    setRestTimer({ isVisible: false, seconds: 0, startingSeconds: 0 });
  }, [clearRestInterval]);

  useEffect(() => {
    return () => {
      clearRestInterval();
    };
  }, [clearRestInterval]);

  useEffect(() => {
    if (!isExerciseModalOpen || !activeWorkoutId) return;
    fetchExerciseDetails(activeWorkoutId);
  }, [isExerciseModalOpen, activeWorkoutId, fetchExerciseDetails]);

  // derived
  const totalSets = useMemo(
    () => exercises.reduce((sum, e) => sum + e.sets.length, 0),
    [exercises]
  );
  const completedSets = useMemo(
    () => exercises.flatMap((e) => e.sets).filter((s) => s.status === "done").length,
    [exercises]
  );
  const progressPct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const activeExerciseDetails = activeWorkoutId
    ? exerciseDetailsCache[activeWorkoutId]
    : null;

  /* ---------- load day data from router state ---------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setExercises([]);
        setHasUnsaved(false);
        setSaveStatus(null);

        const originalApiData = location.state?.originalApiData;
        const passedWorkoutData = location.state?.workoutData;
        const dayData =
          originalApiData ??
          (passedWorkoutData && passedWorkoutData.originalApiData);

        if (!dayData) throw new Error("API data not found");
        if (!Array.isArray(dayData.workouts))
          throw new Error("Invalid workout data: missing workouts array.");

        const built = buildExercisesFromDay(dayData);
        if (!mounted) return;

        setExercises(built);
        setWorkoutMeta({
          day: dayData.day_name || `Day ${dayData.day_number}`,
        });
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load workout");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [location.key, JSON.stringify(location.state)]);

  /* ---------- actions ---------- */
  const handleStart = (exerciseId, setId) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exerciseId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id !== setId
                  ? s
                  : { ...s, status: "in-progress", startedAt: new Date().toISOString() }
              ),
            }
      )
    );
  };

  const handleComplete = (exerciseId, setId) => {
    const key = `${exerciseId}-${setId}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);

    // 1) Read current snapshot to build the next set FIRST
    const ex = exercises.find(e => e.id === exerciseId);
    if (!ex) {
      inFlight.current.delete(key);
      return;
    }
    const prevSet = ex.sets.find(s => s.id === setId);
    if (!prevSet) {
      inFlight.current.delete(key);
      return;
    }

    startRestTimer();

    const completedAt = new Date().toISOString();
    const duration = prevSet.startedAt
      ? Math.max(0, (new Date(completedAt) - new Date(prevSet.startedAt)) / 1000)
      : (Number.isFinite(Number(prevSet.duration)) ? Number(prevSet.duration) : null);
  
    const nextSet = {
      ...prevSet,
      status: "done",
      duration,
      completedAt,
      isFromSession: false,
      isSynced: false,
      saveError: false,
    };
  
    // 2) Optimistic UI update
    setExercises(prev =>
      prev.map(e =>
        e.id !== exerciseId
          ? e
          : {
              ...e,
              sets: e.sets.map(s => (s.id === setId ? nextSet : s)),
              status: (() => {
                const done = e.sets.map(s => (s.id === setId ? nextSet : s)).filter(s => s.status === "done").length;
                return done === e.sets.length && e.sets.length > 0
                  ? "done"
                  : done > 0
                  ? "in-progress"
                  : "pending";
              })(),
            }
      )
    );
  
    // 3) Fire the request (always), then mark synced or error
    (async () => {
      try {
        await saveSingleSet(ex, nextSet); // POST /sessions/save
        setExercises(curr =>
          curr.map(e =>
            e.id !== exerciseId
              ? e
              : {
                  ...e,
                  sets: e.sets.map(s =>
                    s.id !== setId
                      ? s
                      : { ...s, isSynced: true, isFromSession: true, lastSaved: new Date().toISOString(), saveError: false }
                  ),
                }
          )
        );
      } catch (err) {
        // Show retryable state
        setExercises(curr =>
          curr.map(e =>
            e.id !== exerciseId
              ? e
              : {
                  ...e,
                  sets: e.sets.map(s =>
                    s.id !== setId ? s : { ...s, isSynced: false, saveError: true }
                  ),
                }
          )
        );
        setHasUnsaved(true);
        console.warn("Save failed:", err);
      } finally {
        inFlight.current.delete(key);
      }
    })();
  };
  

  async function saveSingleSet(exercise, setData) {
    const payload = { workoutSessions: [toApiSession(exercise, [setData])] };
    const res = await fetch(getApiUrl("/sessions/save"), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Save failed: ${res.status} ${t}`);
    }
    return res.json();
  }

  const handleManualSave = async () => {
    if (!hasUnsaved || isSaving) return;
    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const toSave = exercises
        .map((ex) => ({
          ex,
          sets: ex.sets.filter(
            (s) =>
              (s.status === "done" && !s.isFromSession && !s.isSynced) ||
              (s.isModified && !s.isSynced)
          ),
        }))
        .filter((x) => x.sets.length > 0);

      if (toSave.length === 0) {
        setHasUnsaved(false);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 1200);
        return;
      }

      const workoutSessions = toSave.map(({ ex, sets }) =>
        toApiSession(
          ex,
          sets.map((s) => ({
            ...s,
            duration:
              Number.isFinite(Number(s.duration))
                ? Number(s.duration)
                : s.completedAt && s.startedAt
                ? Math.max(0, (new Date(s.completedAt) - new Date(s.startedAt)) / 1000)
                : undefined,
          }))
        )
      );

      const res = await fetch(getApiUrl("/sessions/save"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ workoutSessions }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Save failed: ${res.status} ${t}`);
      }

      const included = new Set(
        toSave.flatMap(({ ex, sets }) => sets.map((s) => `${ex.id}#${s.id}`))
      );
      setExercises((prev) =>
        prev.map((ex) => ({
          ...ex,
          sets: ex.sets.map((s) =>
            included.has(`${ex.id}#${s.id}`)
              ? {
                  ...s,
                  isSynced: true,
                  isFromSession: s.status === "done" ? true : s.isFromSession,
                  isModified: false,
                  lastSaved: new Date().toISOString(),
                }
              : s
          ),
        }))
      );

      setHasUnsaved(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 1200);
    } catch (e) {
      setSaveStatus("error");
      alert(e.message || "Failed to save workout");
      setTimeout(() => setSaveStatus(null), 1800);
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------- inline editing ---------- */
  const onCellClick = (exerciseId, setId, field) =>
    setEditing({ exerciseId, setId, field });

  const onCellEdit = (exerciseId, setId, field, raw) => {
    let val = raw;
    if (field === "weight") {
      val = useMetric
        ? Math.max(0, parseFloat(raw) || 0)
        : weightConverter.lbsToKg(Math.max(0, parseInt(raw) || 0));
    } else if (field === "reps") {
      val = Math.max(0, parseInt(raw) || 0);
    }

    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exerciseId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id !== setId
                  ? s
                  : {
                      ...s,
                      isModified: true,
                      isSynced: false,
                      ...(field === "weight" ? { weight: val } : {}),
                      ...(field === "reps" ? { reps: val } : {}),
                    }
              ),
            }
      )
    );
    setEditing(null);
    setHasUnsaved(true);
  };

  const renderEditableCell = (exercise, set, field) => {
    const isEditing =
      editing?.exerciseId === exercise.id &&
      editing?.setId === set.id &&
      editing?.field === field;

    if (isEditing) {
      const display =
        field === "weight"
          ? useMetric
            ? numOr(set.weight, 0)
            : Math.round(weightConverter.kgToLbs(set.weight || 0))
          : set[field] ?? 0;

      return (
        <input
          type="number"
          className="table-cell-input"
          defaultValue={display}
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => onCellEdit(exercise.id, set.id, field, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              onCellEdit(exercise.id, set.id, field, e.target.value);
            if (e.key === "Escape") setEditing(null);
          }}
          min="0"
          step={field === "weight" ? (useMetric ? "0.5" : "1") : "1"}
          placeholder={field === "weight" ? (useMetric ? "kg" : "lb") : "reps"}
        />
      );
    }

    const display =
      field === "weight"
        ? weightConverter.display(set.weight, useMetric)
        : set[field] ?? "-";

    return (
      <span
        className="editable-cell"
        onClick={(e) => {
          e.stopPropagation();
          onCellClick(exercise.id, set.id, field);
        }}
        title={`Click to edit ${field}`}
      >
        {display}
      </span>
    );

  };

  /* ---------- leave warning ---------- */
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "You have unsaved workout data. Save before leaving!";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <div className="workout-detail-container">
        <div className="workout-loading">
          <div className="spinner-border text-primary" role="status" />
          <span className="ms-2">Loading workout...</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="workout-detail-container">
        <div className="workout-error">
          <h3>Workout Loading Error</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate("/schedule")}>
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }
  if (!workoutMeta) {
    return (
      <div className="workout-detail-container">
        <div className="workout-error">
          <h3>No workout data available</h3>
          <button className="btn btn-primary" onClick={() => navigate("/schedule")}>
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workout-detail-container">
      {restTimer.isVisible && (
        <RestTimerBubble
          seconds={restTimer.seconds}
          startingSeconds={restTimer.startingSeconds}
          onAdjust={adjustRestTimer}
          onClose={closeRestTimer}
        />
      )}
      {/* Header */}
      <div className="workout-detail-header">
        <button
          className="back-button"
          onClick={() => {
            if (hasUnsaved && !window.confirm("You have unsaved changes. Leave without saving?")) return;
            navigate("/schedule");
          }}
        >
          Back
        </button>
        <h1 className="workout-title">{workoutMeta.day}</h1>
      </div>

      {/* Progress */}
      <div className="workout-progress-section">
        <h3 className="progress-title">Workout Progress</h3>
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <p className="progress-text">
          {completedSets} of {totalSets} sets completed ({progressPct}%)
        </p>

        {hasUnsaved && (
          <>
            <div className="unsaved-indicator">
              You have unsaved changes. Completed sets auto-save, or click "Save Workout" to save all.
            </div>
            <div className="save-controls">
              <button className="save-button" onClick={handleManualSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Workout"}
              </button>
            </div>
          </>
        )}

        {saveStatus && (
          <div className={`save-status ${saveStatus}`}>
            {saveStatus === "saving" && "Saving workout..."}
            {saveStatus === "saved" && "Workout saved successfully!"}
            {saveStatus === "error" && "Failed to save workout"}
          </div>
        )}
      </div>

      {/* Units */}
      <div className="unit-toggle-container">
        <button
          className={`unit-toggle-btn ${useMetric ? "active" : ""}`}
          onClick={() => setUseMetric((v) => !v)}
        >
          Display: {useMetric ? "Metric (kg)" : "Imperial (lb)"}
        </button>
      </div>

      {/* Exercises */}
      {replacementFeedback && (
        <div
          className={`exercise-replacement-feedback exercise-replacement-feedback--${replacementFeedback.type}`}
          role={replacementFeedback.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {replacementFeedback.message}
        </div>
      )}
      <div className="exercises-container">
        {exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="exercise-detail-card"
            role="button"
            tabIndex={0}
            aria-label={`View details for ${exercise.name}`}
            onClick={() => openExerciseModal(exercise)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openExerciseModal(exercise);
              }
            }}
          >
            <div className="exercise-header">
              <div className="exercise-header-main">
                <h3 className="exercise-name" title="View exercise details">
                  {exercise.name}
                </h3>
                <button
                  type="button"
                  className="exercise-swap-trigger"
                  title="¿Máquina ocupada? Ver alternativas"
                  aria-label={`Ver alternativas para ${exercise.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAlternativesModal(exercise);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <SwapArrowsIcon className="exercise-swap-trigger__icon" />
                </button>
              </div>
              <span
                className={`exercise-status-badge ${
                  exercise.status === "done"
                    ? "exercise-done"
                    : exercise.status === "in-progress"
                    ? "exercise-progress"
                    : ""
                }`}
              >
                {exercise.status === "pending" && "Pending"}
                {exercise.status === "in-progress" && "In Progress"}
                {exercise.status === "done" && "Done"}
              </span>
            </div>

            <div className="sets-table">
              <div className="sets-header">
                <span>Set</span>
                <span>Weight</span>
                <span>Reps</span>
                <span>Time</span>
                <span>Action</span>
              </div>

              {exercise.sets.length === 0 ? (
                <div className="set-row">
                  <span className="set-number" style={{ gridColumn: "1 / -1" }}>
                    No sets available for this exercise yet.
                  </span>
                </div>
              ) : (
                exercise.sets.map((set) => (
                  <div
                    key={set.id}
                    className={`set-row ${
                      set.status === "in-progress" ? "set-active" : ""
                    } ${set.status === "done" ? "set-completed" : ""}`}
                  >
                    <span className="set-number">{set.id}</span>

                    <span className="set-weight">
                      {renderEditableCell(exercise, set, "weight")}
                    </span>

                    <span className="set-reps">
                      {renderEditableCell(exercise, set, "reps")}
                    </span>

                    <span
                      className={`set-time ${
                        set.status === "done" && set.duration ? "completed" : "pending"
                      }`}
                    >
                      {set.status === "done" && set.duration ? fmtElapsed(set.duration) : "-"}
                    </span>

                    <div className="set-action">
                      {set.status === "done" ? (
                        <span
                          className={`status-badge status-done ${
                            set.isSynced ? "synced" : "status-saving"
                          }`}
                        >
                          {set.isSynced ? "Done ✓" : "Saving..."}
                        </span>
                      ) : set.status === "in-progress" ? (
                        <button
                          className="btn btn-warning btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleComplete(exercise.id, set.id);
                          }}
                        >
                          End
                        </button>
                      ) : (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStart(exercise.id, set.id);
                          }}
                        >
                          Start
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <ExerciseDetailModal
        open={isExerciseModalOpen}
        onClose={closeExerciseModal}
        exercise={activeExercise}
        details={activeExerciseDetails}
        status={exerciseDetailStatus}
        onGoogleSearch={handleGoogleSearch}
        onRetry={
          activeWorkoutId
            ? () => fetchExerciseDetails(activeWorkoutId, true)
            : undefined
        }
      />
      <ExerciseAlternativesModal
        open={isAlternativesModalOpen}
        onClose={closeAlternativesModal}
        onConfirm={handleConfirmAlternative}
        onSelect={handleSelectAlternative}
        selectedAlternativeId={selectedAlternativeId}
        exerciseName={alternativesTargetExercise?.name}
        alternatives={(() => {
          const workoutId =
            alternativesTargetExercise?.workout_id ??
            alternativesTargetExercise?.workoutId ??
            null;
          return workoutId ? alternativesCache[workoutId] : [];
        })()}
        status={alternativesStatus}
        isConfirming={replacementRequest.state === "loading"}
        confirmationStatus={replacementRequest}
      />
    </div>
  );
}
