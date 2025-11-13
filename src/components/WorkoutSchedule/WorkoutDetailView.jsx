// src/components/WorkoutSchedule/WorkoutDetailView.jsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/components/ToastManager";
import "./WorkoutDetailView.css";
import { weightConverter } from "./workoutUtils";
import RestBadge from "./RestBadge";
import ExerciseDetailModal from "./ExerciseDetailModal";
import ExerciseAlternativesModal from "./ExerciseAlternativesModal";

function useAdaptiveTextFit(ref, text) {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frameId = null;

    const adjust = () => {
      const node = ref.current;
      if (!node) return;

      node.style.fontSize = "";
      node.classList.remove("is-truncated");

      const computed = window.getComputedStyle(node);
      const defaultSize = parseFloat(computed.fontSize) || 18;
      const minSize = Math.max(defaultSize - 3, defaultSize * 0.92);

      let currentSize = defaultSize;
      while (node.scrollWidth > node.clientWidth && currentSize > minSize) {
        currentSize = Math.max(currentSize - 0.5, minSize);
        node.style.fontSize = `${currentSize}px`;
        if (currentSize <= minSize) break;
      }

      if (node.scrollWidth > node.clientWidth) {
        node.classList.add("is-truncated");
      }
    };

    const scheduleAdjust = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(adjust);
    };

    scheduleAdjust();

    const node = ref.current;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleAdjust)
        : null;

    if (observer && node) {
      observer.observe(node);
      if (node.parentElement) {
        observer.observe(node.parentElement);
      }
    }

    window.addEventListener("resize", scheduleAdjust);

    return () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener("resize", scheduleAdjust);
    };
  }, [ref, text]);
}

function AdaptiveExerciseNameButton({ name, onClick, ariaLabel }) {
  const buttonRef = useRef(null);

  useAdaptiveTextFit(buttonRef, name);

  return (
    <button
      type="button"
      className="exercise-name-button"
      onClick={onClick}
      title={name}
      aria-label={ariaLabel}
      ref={buttonRef}
    >
      {name}
    </button>
  );
}

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
      const setNumber = Number(s.setNumber ?? s.id);
      const weight = Number(s.weight);
      const reps = Number(s.reps);
      if (!Number.isInteger(setNumber)) {
        throw new Error("Invalid set data: set number is required.");
      }
      if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
        throw new Error("Invalid set data: weight and reps are required.");
      }

      const out = {
        setNumber,
        weight,
        reps,
        weightUnit: s.weightUnit || "kg",
      };

      const duration = Number.isFinite(Number(s.duration ?? s.elapsedTime))
        ? Number(s.duration ?? s.elapsedTime)
        : null;
      if (duration != null) out.elapsedTime = duration;
      return out;
    }),
  };
}

const DEFAULT_REST_SECONDS = 120;
const INITIAL_REST_STATE = {
  isVisible: false,
  secondsRemaining: 0,
  startingSeconds: 0,
  elapsedSeconds: 0,
  exerciseId: null,
  setId: null,
};

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
  const [searchParams] = useSearchParams();
  const locationStateKey = useMemo(
    () => JSON.stringify(location.state ?? {}),
    [location.state]
  );
  const parsedLocationState = useMemo(() => {
    if (!locationStateKey) return null;
    try {
      return JSON.parse(locationStateKey);
    } catch {
      return null;
    }
  }, [locationStateKey]);
  const dayQueryValue = searchParams.get("day");
  const stateDayNumber = useMemo(() => {
    const originalDayNumber =
      parsedLocationState?.originalApiData?.day_number ??
      parsedLocationState?.workoutData?.originalApiData?.day_number ??
      null;
    const parsed = Number(originalDayNumber);
    return Number.isNaN(parsed) ? null : parsed;
  }, [parsedLocationState]);
  const targetDayNumber = useMemo(() => {
    const fromQuery = Number(dayQueryValue);
    if (!Number.isNaN(fromQuery)) return fromQuery;
    return stateDayNumber;
  }, [dayQueryValue, stateDayNumber]);

  // state
  const [exercises, setExercises] = useState([]);
  const [workoutMeta, setWorkoutMeta] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [editing, setEditing] = useState(null); // {exerciseId,setId,field,initialValue}
  const [shouldAutoFocusEditing, setShouldAutoFocusEditing] = useState(false);
  const autoSaveTimers = useRef(new Map());
  const exercisesRef = useRef([]);
  const lastResolvedFetchSignatureRef = useRef(null);
  const activeFetchRef = useRef(null);
  const isMountedRef = useRef(true);
  const editingInputRef = useRef(null);
  const handleEditingInputRef = useCallback((node) => {
    editingInputRef.current = node;
  }, []);
  const updateExercises = useCallback((updater) => {
    setExercises((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      exercisesRef.current = next;
      return next;
    });
  }, []);
  const applyDayData = useCallback(
    (dayData) => {
      if (!dayData) {
        throw new Error("Invalid workout data: missing day information.");
      }

      const built = buildExercisesFromDay(dayData);

      autoSaveTimers.current.forEach((t) => clearTimeout(t));
      autoSaveTimers.current.clear();

      updateExercises(built);
      setWorkoutMeta({
        day: dayData.day_name || `Day ${dayData.day_number}`,
        dayNumber: dayData.day_number ?? null,
      });
    },
    [updateExercises, setWorkoutMeta]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restTimer, setRestTimer] = useState(INITIAL_REST_STATE);
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
  const restIntervalRef = useRef(null);
  const inFlight = useRef(new Set()); // guard: `${exerciseId}-${setId}`

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
    setAlternativesStatus({ state: "idle", message: "" });
  }, []);

  const handleSelectAlternative = useCallback((altId, alt) => {
    setSelectedAlternativeId(altId);
    setSelectedAlternative(alt);
  }, []);

  const performAlternativeReplacement = useCallback(
    async (exercise, alternative) => {
      if (!exercise || !alternative) {
        toast.show(
          "danger",
          "❌ No se pudo completar el reemplazo del ejercicio seleccionado."
        );
        return;
      }

      const scheduleId =
        exercise?.scheduleId ?? exercise?.schedule_id ?? exercise?.id ?? null;
      const replacementWorkoutId =
        alternative?.workout_id ??
        alternative?.workoutId ??
        alternative?.id ??
        null;

      if (scheduleId == null) {
        toast.show(
          "danger",
          "❌ No se pudo identificar el ejercicio que deseas reemplazar."
        );
        return;
      }

      if (replacementWorkoutId == null) {
        toast.show(
          "danger",
          "❌ No se pudo identificar la alternativa seleccionada."
        );
        return;
      }

      try {
        const response = await fetch(
          getApiUrl(`/schedule/workout/replace/${encodeURIComponent(scheduleId)}`),
          {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ workout_id: replacementWorkoutId }),
          }
        );

        const rawBody = await response.text().catch(() => "");
        let payload = null;
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody);
          } catch {
            payload = null;
          }
        }

        if (!response.ok) {
          const message =
            payload?.error ||
            payload?.message ||
            (typeof payload === "string" ? payload : null) ||
            rawBody ||
            "No se pudo reemplazar el ejercicio.";
          toast.show("danger", `❌ ${message}`);
          return;
        }

        const updatedFromPayload =
          payload?.data?.workout || payload?.data || payload?.workout || {};

        const nextWorkoutId =
          updatedFromPayload?.workout_id ??
          updatedFromPayload?.workoutId ??
          updatedFromPayload?.id ??
          replacementWorkoutId;

        const previousWorkoutId =
          exercise?.workout_id ?? exercise?.workoutId ?? null;

        updateExercises((prev) =>
          prev.map((ex) => {
            const currentId = ex?.scheduleId ?? ex?.id ?? null;
            if (String(currentId) !== String(scheduleId)) return ex;

            const normalizedWorkoutId =
              nextWorkoutId ?? ex.workout_id ?? ex.workoutId ?? null;
            const nextName =
              updatedFromPayload?.name ??
              payload?.data?.name ??
              alternative?.name ??
              ex.name;
            const nextCategory =
              updatedFromPayload?.category ?? alternative?.category ?? ex.category;
            const nextType =
              updatedFromPayload?.type ?? alternative?.type ?? ex.type;

            return {
              ...ex,
              name: nextName || ex.name,
              category: nextCategory ?? ex.category,
              type: nextType ?? ex.type,
              workout_id: normalizedWorkoutId,
              workoutId: normalizedWorkoutId,
            };
          })
        );

        if (previousWorkoutId != null) {
          setAlternativesCache((prev) => {
            if (!(previousWorkoutId in prev)) return prev;
            const next = { ...prev };
            delete next[previousWorkoutId];
            return next;
          });
        }

        const successMessage = alternative?.name
          ? `Ejercicio reemplazado por "${alternative.name}".`
          : "Ejercicio reemplazado correctamente.";

        toast.show("success", `✅ ${successMessage}`);
      } catch (error) {
        console.error("Failed to replace exercise", error);
        const message =
          error?.message || "No se pudo reemplazar el ejercicio. Intenta nuevamente.";
        toast.show("danger", `❌ ${message}`);
      }
    },
    [setAlternativesCache]
  );

  const handleConfirmAlternative = useCallback(
    (_alternativeId, alternativeFromModal) => {
      const alternative = alternativeFromModal ?? selectedAlternative;
      if (!alternativesTargetExercise || !alternative) return;
      performAlternativeReplacement(alternativesTargetExercise, alternative);
      closeAlternativesModal();
    },
    [
      alternativesTargetExercise,
      selectedAlternative,
      closeAlternativesModal,
      performAlternativeReplacement,
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
    (exerciseId, setId, initialSeconds = DEFAULT_REST_SECONDS) => {
      const normalized = Math.max(0, Math.round(initialSeconds));
      clearRestInterval();

      if (normalized <= 0) {
        setRestTimer(INITIAL_REST_STATE);
        return false;
      }

      setRestTimer({
        isVisible: true,
        secondsRemaining: normalized,
        startingSeconds: normalized,
        elapsedSeconds: 0,
        exerciseId,
        setId,
      });

      restIntervalRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (!prev.isVisible) return prev;
          return {
            ...prev,
            secondsRemaining: Math.max(0, prev.secondsRemaining - 1),
            elapsedSeconds: prev.elapsedSeconds + 1,
          };
        });
      }, 1000);
      return true;
    },
    [clearRestInterval]
  );

  const closeRestTimer = useCallback(() => {
    clearRestInterval();
    setRestTimer(INITIAL_REST_STATE);
  }, [clearRestInterval]);

  useEffect(() => {
    return () => {
      clearRestInterval();
    };
  }, [clearRestInterval]);

  useEffect(() => {
    if (restTimer.isVisible && restTimer.secondsRemaining <= 0) {
      closeRestTimer();
    }
  }, [closeRestTimer, restTimer.isVisible, restTimer.secondsRemaining]);

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
    const statePayload =
      parsedLocationState?.originalApiData ??
      parsedLocationState?.workoutData?.originalApiData ??
      null;

    const resetLocalState = () => {
      autoSaveTimers.current.forEach((t) => clearTimeout(t));
      autoSaveTimers.current.clear();
      if (!isMountedRef.current) return;
      updateExercises([]);
    };

    const appliedFromState = (() => {
      if (!statePayload) return false;
      try {
        applyDayData(statePayload);
        setError(null);
        return true;
      } catch (err) {
        setError(err.message || "Failed to load workout");
        resetLocalState();
        return false;
      }
    })();

    if (!appliedFromState) {
      resetLocalState();
    }

    const fetchSignature = JSON.stringify({
      locationKey: location.key,
      stateKey: locationStateKey,
      targetDay: targetDayNumber ?? null,
    });
    const shouldFetchLatest =
      lastResolvedFetchSignatureRef.current !== fetchSignature;

    if (!shouldFetchLatest) {
      setLoading(false);
      return () => {};
    }

    const existingFetch = activeFetchRef.current;
    const hasActiveSameSignature =
      existingFetch &&
      existingFetch.signature === fetchSignature &&
      !existingFetch.controller.signal.aborted;

    if (hasActiveSameSignature) {
      return () => {};
    }

    if (
      existingFetch &&
      existingFetch.controller &&
      !existingFetch.controller.signal.aborted &&
      existingFetch.signature !== fetchSignature
    ) {
      existingFetch.controller.abort();
    }

    const abortController = new AbortController();
    activeFetchRef.current = { signature: fetchSignature, controller: abortController };
    setLoading(true);

    const fetchLatest = async () => {
      try {
        const token =
          localStorage.getItem("jwt_token") ||
          localStorage.getItem("X-API-Token");
        if (!token) {
          throw new Error("No autenticado. Inicia sesión nuevamente.");
        }

        const response = await fetch(getApiUrl("/schedule/v2"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            text || "No se pudo cargar el entrenamiento más reciente."
          );
        }

        const payload = await response.json().catch(() => ({}));
        const schedule = Array.isArray(payload.schedule)
          ? payload.schedule
          : [];

        let resolvedDay = null;
        if (targetDayNumber != null) {
          resolvedDay = schedule.find(
            (day) => Number(day?.day_number) === Number(targetDayNumber)
          );
        }
        if (!resolvedDay && statePayload) {
          resolvedDay = schedule.find(
            (day) =>
              Number(day?.day_number) === Number(statePayload.day_number) ||
              day?.day_name === statePayload.day_name
          );
        }
        if (!resolvedDay) {
          resolvedDay = schedule.find(
            (day) => Array.isArray(day?.workouts) && day.workouts.length > 0
          );
        }
        if (!resolvedDay) {
          throw new Error("No se encontró el entrenamiento solicitado.");
        }
        if (!Array.isArray(resolvedDay.workouts)) {
          throw new Error("Invalid workout data: missing workouts array.");
        }
        if (!isMountedRef.current) {
          return;
        }
        applyDayData(resolvedDay);
        setError(null);
        lastResolvedFetchSignatureRef.current = fetchSignature;
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }
        if (isMountedRef.current) {
          setError(err.message || "Failed to load workout");
          resetLocalState();
        }
        lastResolvedFetchSignatureRef.current = null;
      } finally {
        if (activeFetchRef.current?.controller === abortController) {
          activeFetchRef.current = null;
        }
        if (!abortController.signal.aborted && isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchLatest();

    return () => {};
  }, [
    applyDayData,
    location.key,
    locationStateKey,
    parsedLocationState,
    targetDayNumber,
    updateExercises,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeFetchRef.current = null;
    };
  }, []);

  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  useEffect(() => () => {
    autoSaveTimers.current.forEach((t) => clearTimeout(t));
    autoSaveTimers.current.clear();
  }, []);

  const hasUnsaved = useMemo(
    () =>
      exercises.some((ex) =>
        ex.sets.some(
          (set) => set.status === "done" && (!set.isSynced || set.saveError)
        )
      ),
    [exercises]
  );

  const getInputDefaultValue = useCallback(
    (set, field) => {
      if (!set) return "";
      if (field === "weight") {
        return useMetric
          ? numOr(set.weight, 0)
          : Math.round(weightConverter.kgToLbs(numOr(set.weight, 0)));
      }

      return numOr(set[field], 0);
    },
    [useMetric]
  );

  /* ---------- actions ---------- */
  const handleStart = (exerciseId, setId) => {
    updateExercises((prev) =>
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

  const setEditingWithFocus = useCallback(
    (nextEditing, shouldFocus = false) => {
      setEditing(nextEditing);
      setShouldAutoFocusEditing(Boolean(nextEditing && shouldFocus));
    },
    [setEditing, setShouldAutoFocusEditing]
  );

  useEffect(() => {
    if (shouldAutoFocusEditing && editingInputRef.current) {
      editingInputRef.current.focus();
      setShouldAutoFocusEditing(false);
    }
  }, [shouldAutoFocusEditing, editing, setShouldAutoFocusEditing]);

  const handleComplete = (exerciseId, setId) => {
    const key = `${exerciseId}-${setId}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);

    const exercise = exercisesRef.current.find((e) => e.id === exerciseId);
    if (!exercise) {
      inFlight.current.delete(key);
      return;
    }
    const prevSet = exercise.sets.find((s) => s.id === setId);
    if (!prevSet) {
      inFlight.current.delete(key);
      return;
    }

    startRestTimer(exerciseId, setId);

    const completedAt = new Date().toISOString();
    const duration = prevSet.startedAt
      ? Math.max(0, (new Date(completedAt) - new Date(prevSet.startedAt)) / 1000)
      : Number.isFinite(Number(prevSet.duration))
      ? Number(prevSet.duration)
      : null;

    const nextSet = {
      ...prevSet,
      status: "done",
      duration,
      completedAt,
      isFromSession: false,
      isSynced: false,
      saveError: false,
    };

    updateExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exerciseId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? nextSet : s)),
              status: (() => {
                const done = ex.sets
                  .map((s) => (s.id === setId ? nextSet : s))
                  .filter((s) => s.status === "done").length;
                return done === ex.sets.length && ex.sets.length > 0
                  ? "done"
                  : done > 0
                  ? "in-progress"
                  : "pending";
              })(),
            }
      )
    );

    setEditingWithFocus(null);
    queueSetAutoSave(exerciseId, setId, 0);
    inFlight.current.delete(key);
  };
  const saveSingleSet = useCallback(async (exercise, setData) => {
    const payload = { workoutSessions: [toApiSession(exercise, [setData])] };
    const preferredMethod = setData.isFromSession ? "PATCH" : "POST";

    const attemptSave = async (method) => {
      const res = await fetch(getApiUrl("/sessions/save"), {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        const error = new Error(`Save failed: ${res.status} ${t}`);
        error.status = res.status;
        error.body = t;
        throw error;
      }
      try {
        return await res.json();
      } catch {
        return null;
      }
    };

    try {
      return await attemptSave(preferredMethod);
    } catch (err) {
      if (
        preferredMethod === "PATCH" &&
        (err?.status === 404 || /not found/i.test(err?.body || ""))
      ) {
        return attemptSave("POST");
      }
      throw err;
    }
  }, []);

  const saveSetNow = useCallback(
    async (exerciseId, setId) => {
      const key = `${exerciseId}-${setId}`;
      if (inFlight.current.has(key)) return;

      const exercise = exercisesRef.current.find((ex) => ex.id === exerciseId);
      if (!exercise) return;
      const set = exercise.sets.find((s) => s.id === setId);
      if (!set || set.status !== "done") return;

      const weight = Number(set.weight);
      const reps = Number(set.reps);
      if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
        toast.show("danger", "Please enter valid numbers for weight and reps before saving.");
        updateExercises((prev) =>
          prev.map((ex) =>
            ex.id !== exerciseId
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.id !== setId
                      ? s
                      : { ...s, saveError: true, isSynced: false }
                  ),
                }
          )
        );
        return;
      }

      inFlight.current.add(key);
      updateExercises((prev) =>
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
                        isSynced: false,
                        saveError: false,
                      }
                ),
              }
        )
      );

      try {
        await saveSingleSet(exercise, {
          ...set,
          id: set.id,
          weight,
          reps,
          weightUnit: set.weightUnit || "kg",
          duration: Number.isFinite(Number(set.duration))
            ? Number(set.duration)
            : undefined,
        });

        updateExercises((prev) =>
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
                          isSynced: true,
                          isFromSession: true,
                          isModified: false,
                          saveError: false,
                          lastSaved: new Date().toISOString(),
                        }
                  ),
                }
          )
        );
      } catch (err) {
        console.warn("Auto-save failed:", err);
        toast.show("danger", "Failed to save set. Please check your connection and try again.");
        updateExercises((prev) =>
          prev.map((ex) =>
            ex.id !== exerciseId
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.id !== setId
                      ? s
                      : { ...s, isSynced: false, saveError: true }
                  ),
                }
          )
        );
      } finally {
        inFlight.current.delete(key);
      }
    },
    [saveSingleSet]
  );

  const queueSetAutoSave = useCallback(
    (exerciseId, setId, delay = 600) => {
      const key = `${exerciseId}-${setId}`;
      const existing = autoSaveTimers.current.get(key);
      if (existing) clearTimeout(existing);

      autoSaveTimers.current.set(
        key,
        setTimeout(() => {
          autoSaveTimers.current.delete(key);
          saveSetNow(exerciseId, setId);
        }, Math.max(0, delay))
      );
    },
    [saveSetNow]
  );

  const handleRetrySetSave = (exerciseId, setId) => {
    queueSetAutoSave(exerciseId, setId, 0);
  };

  /* ---------- inline editing ---------- */
  const onCellEdit = (exerciseId, setId, field, raw) => {
    const editingContext =
      editing &&
      editing.exerciseId === exerciseId &&
      editing.setId === setId &&
      editing.field === field
        ? editing
        : null;

    const normalizedRaw = raw == null ? "" : String(raw).trim();
    const initialValue = editingContext?.initialValue != null
      ? String(editingContext.initialValue).trim()
      : null;

    const sameAsInitial =
      initialValue != null &&
      (normalizedRaw === initialValue ||
        (!Number.isNaN(Number(normalizedRaw)) &&
          !Number.isNaN(Number(initialValue)) &&
          Number(normalizedRaw) === Number(initialValue)));

    const exercise = exercisesRef.current.find((ex) => ex.id === exerciseId);
    const prevSet = exercise?.sets.find((s) => s.id === setId);

    if (sameAsInitial || !exercise || !prevSet) {
      setEditing(null);
      return;
    }

    let val = raw;
    if (field === "weight") {
      val = useMetric
        ? Math.max(0, parseFloat(raw) || 0)
        : weightConverter.lbsToKg(Math.max(0, parseInt(raw) || 0));
    } else if (field === "reps") {
      val = Math.max(0, parseInt(raw) || 0);
    }

    const prevValue =
      field === "weight"
        ? numOr(prevSet.weight, 0)
        : numOr(prevSet[field], 0);

    if (Number.isFinite(prevValue) && Number.isFinite(Number(val))) {
      const normalizedVal = Number(val);
      const tolerance = field === "weight" ? 0.005 : 0;
      if (Math.abs(normalizedVal - prevValue) <= tolerance) {
        setEditing(null);
        return;
      }
    }

    updateExercises((prev) =>
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
                      saveError: false,
                      ...(field === "weight" ? { weight: val } : {}),
                      ...(field === "reps" ? { reps: val } : {}),
                    }
              ),
            }
      )
    );
    setEditing(null);
    queueSetAutoSave(exerciseId, setId, 0);
  };

  const onCellClick = (exerciseId, setId, field, initialValue) => {
    setEditingWithFocus({ exerciseId, setId, field, initialValue }, true);
  };

  const renderEditableCell = (exercise, set, field) => {
    const isEditing =
      editing?.exerciseId === exercise.id &&
      editing?.setId === set.id &&
      editing?.field === field;

    if (isEditing) {
      const inputDefaultValue = getInputDefaultValue(set, field);

      return (
        <input
          ref={handleEditingInputRef}
          type="number"
          className="table-cell-input"
          defaultValue={inputDefaultValue}
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
          const initialValue = String(getInputDefaultValue(set, field));
          onCellClick(exercise.id, set.id, field, initialValue);
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
      e.returnValue =
        "Your latest workout updates are still syncing. Leaving now may discard them.";
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
      {/* Header */}
      <div className="workout-detail-header">
        <div className="workout-header-bar">
          <div className="header-slot start">
            <button
              className="back-button"
              onClick={() => {
                if (
                  hasUnsaved &&
                  !window.confirm(
                    "Some workout updates are still syncing. Leave this page anyway?"
                  )
                )
                  return;
                navigate("/schedule");
              }}
            >
              ← Back
            </button>
          </div>
          <h1 className="workout-title">{workoutMeta.day}</h1>
          <div className="header-slot end">
            <button
              className={`unit-toggle-btn ${useMetric ? "active" : ""}`}
              onClick={() => setUseMetric((v) => !v)}
            >
              {useMetric ? "Metric (kg)" : "Imperial (lb)"}
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="workout-progress-section">
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <p className="progress-text">
          {completedSets} of {totalSets} sets completed ({progressPct}%)
        </p>

      </div>
      {/* Exercises */}
      <div className="exercises-container">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="exercise-detail-card">
            <div className="exercise-header">
              <div className="exercise-header-main">
                <h3 className="exercise-name" title={exercise.name}>
                  <AdaptiveExerciseNameButton
                    name={exercise.name}
                    onClick={() => openExerciseModal(exercise)}
                    ariaLabel={`View details for ${exercise.name}`}
                  />
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
                <span>Action</span>
              </div>

              {exercise.sets.length === 0 ? (
                <div className="set-row">
                  <span className="set-number" style={{ gridColumn: "1 / -1" }}>
                    No sets available for this exercise yet.
                  </span>
                </div>
              ) : (
                exercise.sets.map((set) => {
                  const isResting =
                    restTimer.isVisible &&
                    restTimer.exerciseId === exercise.id &&
                    restTimer.setId === set.id;
                  const showCooldownBadge =
                    isResting && restTimer.secondsRemaining > 0;

                  return (
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

                      <div className="set-action">
                        {showCooldownBadge ? (
                          <RestBadge
                            remainingSeconds={restTimer.secondsRemaining}
                            elapsedSeconds={restTimer.elapsedSeconds}
                            startingSeconds={restTimer.startingSeconds}
                            onDismiss={closeRestTimer}
                          />
                        ) : set.status === "done" ? (
                          set.saveError ? (
                            <button
                              type="button"
                              className="status-badge status-error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetrySetSave(exercise.id, set.id);
                              }}
                            >
                              Retry Save
                            </button>
                          ) : (
                            <span
                              className={`status-badge status-done ${
                                set.isSynced ? "synced" : "status-saving"
                              }`}
                              role="status"
                              aria-live="polite"
                            >
                              {set.isSynced ? "Saved ✓" : "Saving..."}
                            </span>
                          )
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
                  );
                })
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
      />
    </div>
  );
}
