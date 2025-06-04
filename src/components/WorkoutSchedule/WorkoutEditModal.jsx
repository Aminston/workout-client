import React, { useState } from 'react';
import BaseModal from '@/components/BaseModal/BaseModal';
import { toast } from '@/components/ToastManager';

export default function WorkoutEditModal({ workout, onClose }) {
  const [sets, setSets] = useState(workout.sets ?? '');
  const [reps, setReps] = useState(workout.reps ?? '');
  const [weight, setWeight] = useState(workout.weight?.value ?? '');
  const [unit, setUnit] = useState(workout.weight?.unit ?? 'kg');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);

    const payload = {
      program_id: workout.program_id,
      workout_id: workout.workout_id,
      day: workout.day,
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight_value: parseFloat(weight),
      weight_unit: unit
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/schedule/workout/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.updatedWorkout) {
        toast.show('success', '✅ Workout updated successfully!');
        window.location.reload(); // 🔁 Refresh to re-fetch updated schedule
      } else {
        toast.show('danger', data?.error || '❌ Failed to save changes');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.show('danger', '❌ Network error or invalid server response');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);

    const payload = {
      program_id: workout.program_id,
      workout_id: workout.workout_id,
      day: workout.day
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/schedule/workout/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        toast.show('success', '↩️ Workout reset to original values');
        window.location.reload(); // 🔁 Refresh to show reset workout
      } else {
        toast.show('danger', data?.error || '❌ Failed to reset workout');
      }
    } catch (err) {
      console.error('Reset error:', err);
      toast.show('danger', '❌ Network error on reset');
    } finally {
      setLoading(false);
    }
  };

  const resetButton = workout.is_modified
    ? {
        label: 'Reset',
        variant: 'outline-danger',
        onClick: handleReset,
        disabled: loading
      }
    : null;

  return (
    <BaseModal
      show
      onHide={onClose}
      title={`${workout.name}`}
      onSubmit={handleSave}
      onCancel={onClose}
      canSubmit
      isSubmitting={loading}
      confirmLabel="Save"
      cancelLabel="Cancel"
      confirmVariant="primary"
      extraButtons={[resetButton].filter(Boolean)}
    >
      <div className="modal-body">
        <div className="mb-3">
          <label className="form-label">Sets</label>
          <input
            type="number"
            className="form-control"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Reps</label>
          <input
            type="number"
            className="form-control"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Weight</label>
          <input
            type="number"
            className="form-control"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Unit</label>
          <select
            className="form-select"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="kg">kg</option>
            <option value="lbs">lbs</option>
            <option value="bodyweight">bodyweight</option>
            <option value="none">none</option>
          </select>
        </div>
      </div>
    </BaseModal>
  );
}
