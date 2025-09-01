import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./WorkoutDetailView.css";
import { weightConverter } from "./workoutUtils";

/* ================== helpers ================== */
const toIso = (s) => (typeof s === "string" ? s.replace(" ", "T") : s);
const num = (v, fallback = 0) => Number(v ?? fallback); // NaN-safe numeric fallback

const calcElapsed = (startTime, endTime) => {
  if (!startTime || !endTime) return null;
  const t = new Date(endTime) - new Date(startTime);
  if (!Number.isFinite(t)) return null;
  return Math.round(t / 100) / 10; // tenths of a second
};

const fmtElapsed = (sec) => {
  if (sec == null) return "-";
  if (sec < 60) return sec % 1 === 0 ? `${sec}s` : `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

/** Build sets STRICTLY by position 1..N.
 *  - Picks latest completed session per set_number (created_at desc, then session_id desc)
 *  - Fills gaps as pending
 */
function buildSetsFromWorkout(workout) {
  const latestBySet = {};
  if (Array.isArray(workout.sessions)) {
    for (const s of workout.sessions) {
      if (s?.set_status !== "completed") continue;
      const sn = Number(s.set_number);
      if (!Number.isInteger(sn)) continue;

      const total = num(workout.sets, 0);
      if (sn < 1 || (total > 0 && sn > total)) continue;

      const curr = latestBySet[sn];
      if (!curr) {
        latestBySet[sn] = s;
      } else {
        const currTs = new Date(toIso(curr.created_at)).getTime() || 0;
        const nextTs = new Date(toIso(s.created_at)).getTime() || 0;
        if (nextTs > currTs) latestBySet[sn] = s;
        else if (nextTs === currTs) {
          const currId = num(curr.session_id, 0);
          const nextId = num(s.session_id, 0);
          if (nextId > currId) latestBySet[sn] = s;
        }
      }
    }
  }

  const sets = [];
  const total = num(workout.sets, 3);

  for (let setNum = 1; setNum <= total; setNum++) {
    const session = latestBySet[setNum];

    if (session) {
      sets.push({
        id: setNum,
        reps: num(session.reps, workout.reps),
        weight: num(session.weight?.value, workout.weight?.value),
        weightUnit: session.weight?.unit || workout.weight?.unit || "kg",
        elapsedTime: session.elapsed_time ?? null,
        status: "done",
        completedAt: session.created_at,
        isFromSession: true,
        isSynced: true,
      });
    } else {
      sets.push({
        id: setNum,
        reps: num(workout.reps, 0),
        weight: num(workout.weight?.value, 0),
        weightUnit: workout.weight?.unit || "kg",
        elapsedTime: null,
        status: "pending",
        completedAt: null,
        isFromSession: false,
        isSynced: false,
      });
    }
  }

  const done = sets.filter((s) => s.status === "done").length;
  const status =
    done === sets.length && sets.length > 0
      ? "done"
      : done > 0
      ? "in-progress"
      : "pending";

  return { sets, status };
}

/* ================== component ================== */
export default function WorkoutDetailView() {
  const location = useLocation();
  const navigate = useNavigate();

  // Core state
  const [exercises, setExercises] = useState([]);
  const [totalSets, setTotalSets] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const [workoutData, setWorkoutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [editingCell, setEditingCell] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Prevent duplicate POSTs per set
  const inFlightSaves = useRef(new Set()); // keys like `${exerciseId}-${setId}`

  /* ---------- API helpers ---------- */
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

  /* ---------- counters derived from state ---------- */
  useEffect(() => {
    const all = exercises.flatMap((e) => e.sets);
    setCompletedSets(all.filter((s) => s.status === "done").length);
    setTotalSets(exercises.reduce((sum, e) => sum + e.sets.length, 0));
  }, [exercises]);

  /* ---------- data loader ---------- */
  useEffect(() => {
    let isMounted = true;

    const processWorkoutData = async () => {
      try {
        // Hard reset first (prevents stale merges with previous view)
        setExercises([]);
        setTotalSets(0);
        setCompletedSets(0);
        setHasUnsavedChanges(false);
        setSaveStatus(null);
        setLoading(true);
        setError(null);

        const originalApiData = location.state?.originalApiData;
        const passedWorkoutData = location.state?.workoutData;
        const dayData =
          originalApiData ??
          (passedWorkoutData && passedWorkoutData.originalApiData);

        if (!dayData) throw new Error("API data not found.");
        if (!Array.isArray(dayData.workouts))
          throw new Error("Invalid workout data: missing workouts array.");

        const meta = { day: dayData.day_name || `Day ${dayData.day_number}` };

        const builtExercises = dayData.workouts.map((w) => {
          const { sets, status } = buildSetsFromWorkout(w);
          return {
            id: w.scheduleId,
            scheduleId: w.scheduleId,
            workout_id: w.workout_id,
            name: w.name,
            category: w.category,
            type: w.type,
            sets,
            status,
          };
        });

        if (!isMounted) return;
        setWorkoutData(meta);
        setExercises(builtExercises);
      } catch (e) {
        if (isMounted) setError(e.message || "Failed to load workout.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    processWorkoutData();
    return () => {
      isMounted = false;
    };
    // Re-run if route changes or state actually changes
  }, [location.key, JSON.stringify(location.state)]);

  /* ---------- progressive single-set save ---------- */
  const saveSetProgressive = async (exerciseId, setData) => {
    const key = `${exerciseId}-${setData.id}`;
    if (inFlightSaves.current.has(key)) return;
    inFlightSaves.current.add(key);

    try {
      const exercise = exercises.find((e) => e.id === exerciseId);
      if (!exercise) return;

      const token =
        localStorage.getItem("jwt_token") || localStorage.getItem("X-API-Token");
      if (!token) return;

      const workoutSessions = [
        {
          scheduleId: exercise.scheduleId,
          status: "completed",
          performedSets: [
            {
              setNumber: setData.id,
              reps: setData.reps,
              weight: setData.weight,
              weightUnit: setData.weightUnit || "kg",
              elapsedTime: setData.elapsedTime,
            },
          ],
        },
      ];

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(getApiUrl("/sessions/save"), {
        method: "POST",
        signal: controller.signal,
        headers: {
          ...getAuthHeaders(),
          "X-Client-Type": "mobile-webapp-progressive",
        },
        body: JSON.stringify({ workoutSessions }),
      });

      clearTimeout(t);
      if (!res.ok) throw new Error(`Progressive save failed: ${res.status}`);

      // mark as synced
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id !== exerciseId
            ? ex
            : {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.id !== setData.id
                    ? s
                    : {
                        ...s,
                        isSynced: true,
                        progressivelySaved: true,
                        lastSaved: new Date().toISOString(),
                      }
                ),
              }
        )
      );
    } catch {
      // silent; bulk save will handle retries/alerts
    } finally {
      inFlightSaves.current.delete(key);
    }
  };

  /* ---------- bulk save (only unsynced) ---------- */
  const handleManualSave = async () => {
    if (!hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    setSaveStatus("saving");
    const token =
      localStorage.getItem("jwt_token") || localStorage.getItem("X-API-Token");

    if (!token) {
      setHasUnsavedChanges(false);
      setIsSaving(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
      return;
    }

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
        setHasUnsavedChanges(false);
        setIsSaving(false);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2000);
        return;
      }

      const workoutSessions = toSave.map(({ ex, sets }) => ({
        scheduleId: ex.scheduleId,
        status: "completed",
        performedSets: sets.map((s) => {
          const elapsedTime = calcElapsed(s.startTime, s.completedAt);
          return {
            setNumber: s.id,
            reps: s.reps,
            weight: s.weight,
            weightUnit: s.weightUnit || "kg",
            ...(elapsedTime != null ? { elapsedTime } : {}),
          };
        }),
      }));

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 45000);

      const res = await fetch(getApiUrl("/sessions/save"), {
        method: "POST",
        signal: controller.signal,
        headers: { ...getAuthHeaders(), "X-Client-Type": "mobile-webapp-bulk" },
        body: JSON.stringify({ workoutSessions }),
      });

      clearTimeout(t);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }

      const result = await res.json();
      const sessions =
        (result.success && result.sessions) ||
        (result.scheduleId && result.savedSets && [result]);
      if (!sessions) throw new Error("Invalid save response format");

      // mark saved sets
      setExercises((prev) =>
        prev.map((ex) => {
          const exResult = sessions.find((s) => s.scheduleId === ex.scheduleId);
          if (!exResult) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s) => {
              const saved = exResult.savedSets?.find((ss) => ss.setNumber === s.id);
              if (!saved) return s;
              return {
                ...s,
                isModified: false,
                isSynced: true,
                lastSaved: new Date().toISOString(),
                isFromSession: s.status === "done" ? true : s.isFromSession,
                elapsedTime:
                  saved.elapsedTime ??
                  s.elapsedTime ??
                  calcElapsed(s.startTime, s.completedAt),
              };
            }),
          };
        })
      );

      setHasUnsavedChanges(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e) {
      setSaveStatus("error");
      const msg =
        e.name === "AbortError"
          ? "Save timed out. Try again."
          : e.message?.match(/401|403/)
          ? "Session expired. Please log in again."
          : `Failed to save workout: ${e.message}`;
      alert(msg);
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  /* ---------- set actions & editing ---------- */
  const handleSetAction = (exerciseId, setId, action) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const sets = ex.sets.map((s) => {
          if (s.id !== setId) return s;
          if (action === "start")
            return { ...s, status: "in-progress", startTime: new Date().toISOString() };
          if (action === "complete") {
            const completedAt = new Date().toISOString();
            const elapsedTime = calcElapsed(s.startTime, completedAt);
            const next = {
              ...s,
              status: "done",
              isFromSession: false,
              isSynced: false,
              elapsedTime,
              completedAt,
            };
            setHasUnsavedChanges(true);
            saveSetProgressive(exerciseId, next); // fire-and-forget
            return next;
          }
          return s;
        });

        const done = sets.filter((s) => s.status === "done").length;
        const status =
          done === sets.length && sets.length > 0
            ? "done"
            : done > 0
            ? "in-progress"
            : "pending";
        return { ...ex, sets, status };
      })
    );
  };

  const handleCellClick = (exerciseId, setId, field) =>
    setEditingCell({ exerciseId, setId, field });

  const handleCellEdit = (exerciseId, setId, field, value) => {
    let processed = value;
    if (field === "weight") {
      processed = useMetric
        ? Math.round(Math.max(0, parseFloat(value) || 0) * 2) / 2
        : weightConverter.lbsToKg(Math.max(0, parseInt(value) || 0));
    } else if (field === "reps") {
      processed = Math.max(0, parseInt(value) || 0);
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
                      ...(field === "weight" ? { weight: processed } : {}),
                      ...(field === "reps" ? { reps: processed } : {}),
                    }
              ),
            }
      )
    );
    setEditingCell(null);
    setHasUnsavedChanges(true);
  };

  const renderEditableCell = (exercise, set, field) => {
    const isEditing =
      editingCell?.exerciseId === exercise.id &&
      editingCell?.setId === set.id &&
      editingCell?.field === field;

    if (isEditing) {
      const display =
        field === "weight"
          ? useMetric
            ? set.weight
            : Math.round(weightConverter.kgToLbs(set.weight || 0))
          : set[field];
      return (
        <input
          type="number"
          className="table-cell-input"
          defaultValue={display}
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => handleCellEdit(exercise.id, set.id, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              handleCellEdit(exercise.id, set.id, field, e.target.value);
            if (e.key === "Escape") setEditingCell(null);
          }}
          min="0"
          step={field === "weight" ? (useMetric ? "0.5" : "1") : "1"}
          placeholder={field === "weight" ? (useMetric ? "kg" : "lbs") : "reps"}
        />
      );
    }

    const display =
      field === "weight"
        ? weightConverter.display(set.weight, useMetric)
        : set[field] ?? "-";
    let cls = `editable-cell ${set.isFromSession ? "from-session" : "from-base"}`;
    if (set.isModified) cls += " modified";
    if (set.isSynced) cls += " synced";

    return (
      <span
        className={cls}
        onClick={() => handleCellClick(exercise.id, set.id, field)}
        title={`Click to edit ${field}`}
      >
        {display}
        {set.isSynced && <span className="sync-indicator">✓</span>}
      </span>
    );
  };

  const getActionButton = (set, exerciseId, setId) => {
    if (set.status === "done")
      return (
        <span className={`status-badge status-done ${set.isSynced ? "synced" : "pending-sync"}`}>
          Done {set.isSynced ? "✓" : "Saving..."}
        </span>
      );
    if (set.status === "in-progress")
      return (
        <button
          className="btn btn-warning btn-sm"
          onClick={() => handleSetAction(exerciseId, setId, "complete")}
        >
          End
        </button>
      );
    return (
      <button
        className="btn btn-success btn-sm"
        onClick={() => handleSetAction(exerciseId, setId, "start")}
      >
        Start
      </button>
    );
  };

  /* ---------- leave warning ---------- */
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "You have unsaved workout data. Save before leaving!";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

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
  if (!workoutData) {
    return (
      <div className="workout-detail-container">
        <div className="workout-error">
          <h3>No workout data available</h3>
          <p>Please navigate from the schedule page to load workout data.</p>
          <button className="btn btn-primary" onClick={() => navigate("/schedule")}>
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <div className="workout-detail-container">
      {/* Header */}
      <div className="workout-detail-header">
        <button
          className="back-button"
          onClick={() => {
            if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Leave without saving?")) return;
            navigate("/schedule");
          }}
        >
          Back
        </button>
        <h1 className="workout-title">{workoutData.day}</h1>
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
          {completedSets} of {totalSets} sets completed ({Math.round(progressPct)}%)
        </p>

        {hasUnsavedChanges && (
          <>
            <div className="unsaved-indicator">
              You have unsaved changes. Sets save automatically when completed, or click "Save Workout" to save all.
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
          Display: {useMetric ? "Metric (kg)" : "Imperial (lbs)"}
        </button>
      </div>

      {/* Exercises */}
      <div className="exercises-container">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="exercise-detail-card">
            <div className="exercise-header">
              <h3
                className="exercise-name exercise-clickable"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = `https://www.google.com/search?q=how+to+${encodeURIComponent(
                    exercise.name
                  )}&tbm=vid`;
                  a.target = "_blank";
                  a.rel = "noopener";
                  a.click();
                }}
                title="Click to watch exercise tutorial videos"
              >
                {exercise.name}
              </h3>
              <span className={`exercise-status-badge ${exercise.status}`}>
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

              {exercise.sets.map((set) => (
                <div
                  key={set.id}
                  className={`set-row ${set.status === "in-progress" ? "set-active" : ""} ${
                    set.status === "done" ? "set-completed" : ""
                  }`}
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
                      set.status === "done" && set.elapsedTime ? "completed" : "pending"
                    }`}
                  >
                    {set.status === "done" && set.elapsedTime
                      ? fmtElapsed(set.elapsedTime)
                      : "-"}
                  </span>
                  <div className="set-action">{getActionButton(set, exercise.id, set.id)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
