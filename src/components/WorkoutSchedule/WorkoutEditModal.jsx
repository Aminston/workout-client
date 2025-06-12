import React, { useState, useMemo } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import BaseModal from '@/components/BaseModal/BaseModal';
import { toast } from '@/components/ToastManager';

export default function WorkoutEditModal({ workout, onClose, onWorkoutUpdate }) {
  const [sets, setSets] = useState(workout.sets ?? '');
  const [reps, setReps] = useState(workout.reps ?? '');
  const [weight, setWeight] = useState(workout.weight?.value ?? '');
  const [unit, setUnit] = useState(workout.weight?.unit ?? 'kg');
  const [loading, setLoading] = useState(false);

  const isValid = useMemo(() => {
    const s = parseInt(sets);
    const r = parseInt(reps);
    const w = parseFloat(weight);
    return s > 0 && r > 0 && (unit === 'none' || unit === 'bodyweight' || w > 0);
  }, [sets, reps, weight, unit]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        program_id: workout.program_id,
        workout_id: workout.workout_id,
        day: workout.day,
        sets: parseInt(sets),
        reps: parseInt(reps),
        weight_value: parseFloat(weight),
        weight_unit: unit,
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/schedule/workout/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwt_token')}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.updatedWorkout) {
        toast.show('success', '✅ Workout updated successfully!');
        onWorkoutUpdate?.(data.updatedWorkout);
        onClose();
      } else {
        toast.show('danger', data?.error || '❌ Failed to save changes');
      }
    } catch (err) {
      toast.show('danger', '❌ Network error or invalid server response');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const payload = {
        program_id: workout.program_id,
        workout_id: workout.workout_id,
        day: workout.day,
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/schedule/workout/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwt_token')}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.updatedWorkout) {
        toast.show('success', '↩️ Workout reset to original values');
        onWorkoutUpdate?.(data.updatedWorkout);
        onClose();
      } else {
        toast.show('danger', data?.error || '❌ Failed to reset workout');
      }
    } catch (err) {
      toast.show('danger', '❌ Network error on reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal show onHide={onClose} title={workout.name}>
      <Form onSubmit={handleSave}>
        <div className="mb-3">
          <label className="form-label">Sets</label>
          <input type="number" className="form-control" value={sets} onChange={(e) => setSets(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Reps</label>
          <input type="number" className="form-control" value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Weight</label>
          <input
            type="number"
            className="form-control"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            disabled={unit === 'none' || unit === 'bodyweight'}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Unit</label>
          <select className="form-select" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="kg">kg</option>
            <option value="lbs">lbs</option>
            <option value="bodyweight">bodyweight</option>
            <option value="none">none</option>
          </select>
        </div>
        <div className="modal-footer modal-footer-actions mt-3">
          {workout.is_modified && (
            <Button
              type="button"
              onClick={handleReset}
              className="btn-modal-confirm btn-accent"
              disabled={loading}
            >
              Reset
            </Button>
          )}
          <Button
            type="button"
            onClick={onClose}
            className="btn-outline-secondary btn-modal-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isValid || loading}
            className="btn-modal-confirm btn-accent"
          >
            {loading ? <Spinner size="sm" animation="border" /> : 'Save'}
          </Button>
        </div>
      </Form>
    </BaseModal>
  );
}
