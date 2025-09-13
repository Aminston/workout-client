// ProfileOnboardingModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import useUserProfile from '../../hooks/useUserProfile';
import { toast } from '../ToastManager';
import './ProfileOnboardingModal.css';

// Steps configuration
const STEPS = [
  { key: 'about', title: 'About You', subtitle: 'Tell us a bit about yourself', fields: ['birthday', 'height', 'weight'] },
  { key: 'injury', title: 'Health & Safety', subtitle: 'Any areas we should be mindful of?', fields: ['injury_caution_area'] },
  { key: 'goal', title: 'Your Goal', subtitle: 'What do you want to achieve?', fields: ['training_goal'] },
  { key: 'experience', title: 'Experience Level', subtitle: 'How familiar are you with working out?', fields: ['training_experience'] },
  { key: 'split', title: 'Workout Schedule', subtitle: 'Choose your training frequency', fields: ['split_id'] },
];

// Option data (goals, levels, injuries)
const WORKOUT_GOALS = [
  { key: 'muscle_gain', icon: '💪', title: 'Build Muscle', description: 'Strength training for muscle growth' },
  { key: 'fat_loss', icon: '🔥', title: 'Lose Weight', description: 'High-intensity fat burning workouts' },
  { key: 'tone_up', icon: '✨', title: 'Tone & Shape', description: 'Balanced fitness and toning' },
  { key: 'improve_strength', icon: '🏋️', title: 'Get Stronger', description: 'Build functional strength' },
  { key: 'general_fitness', icon: '⚡', title: 'Stay Healthy', description: 'Overall fitness and wellness' }
];
const EXPERIENCE_LEVELS = [
  { key: 'beginner', label: 'Beginner', desc: 'New to working out or getting back into it', icon: '🌱' },
  { key: 'casual', label: 'Casual', desc: 'Work out occasionally, know the basics', icon: '🚶' },
  { key: 'consistent', label: 'Consistent', desc: 'Regular workout routine, good form', icon: '🏃' },
  { key: 'advanced', label: 'Advanced', desc: 'Very experienced, understand programming', icon: '🏆' }
];
const INJURY_OPTIONS = [
  { key: 'none', label: 'No concerns', icon: '✅', description: 'Ready for any exercise without restrictions' },
  { key: 'shoulders', label: 'Shoulders', icon: '🤷', description: 'Be mindful of overhead movements' },
  { key: 'lower_back', label: 'Lower Back', icon: '🦴', description: 'Careful with heavy lifting and bending' },
  { key: 'knees', label: 'Knees', icon: '🦵', description: 'Avoid high-impact and deep squats' },
  { key: 'wrists', label: 'Wrists', icon: '✋', description: 'Modify push-ups and planks as needed' },
  { key: 'elbows', label: 'Elbows', icon: '💪', description: 'Be careful with arm and pressing exercises' },
  { key: 'neck', label: 'Neck', icon: '🦒', description: 'Avoid exercises that strain the neck' },
  { key: 'ankles', label: 'Ankles', icon: '🦶', description: 'Modify jumping and balance exercises' },
  { key: 'hips', label: 'Hips', icon: '🕺', description: 'Be mindful of deep hip flexion movements' }
];

// Validation rules (always convert to string first)
const VALIDATION_RULES = {
  birthday: (value) => {
    const s = value == null ? '' : String(value).trim();
    if (s === '') return 'Birthday is required';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'Enter a complete YYYY-MM-DD';
    const date = new Date(s), now = new Date(), minDate = new Date('1900-01-01');
    if (isNaN(date)) return 'Please enter a valid date';
    if (date > now) return 'Birthday cannot be in the future';
    if (date < minDate) return 'Please enter a realistic birthday';
    const age = Math.floor((now - date) / (365.25 * 24 * 3600 * 1000));
    if (age < 13) return 'You must be at least 13 years old';
    if (age > 120) return 'Please enter a realistic birthday';
    return null;
  },
  height: (value) => {
    const s = value == null ? '' : String(value).trim();
    if (s === '') return 'Height is required';
    const n = parseFloat(s);
    if (isNaN(n) || n <= 0) return 'Please enter a valid height';
    if (n > 300) return 'Height seems too high (max 300cm)';
    if (n < 50) return 'Height seems too low (min 50cm)';
    return null;
  },
  weight: (value) => {
    const s = value == null ? '' : String(value).trim();
    if (s === '') return 'Weight is required';
    const n = parseFloat(s);
    if (isNaN(n) || n <= 0) return 'Please enter a valid weight';
    if (n > 1000) return 'Weight seems too high (max 1000kg)';
    if (n < 20) return 'Weight seems too low (min 20kg)';
    return null;
  },
  training_goal: (v) => (!v ? 'Please select a goal' : null),
  training_experience: (v) => (!v ? 'Please select experience level' : null),
  injury_caution_area: (v) => (!v ? 'Please select an option' : null),
  split_id: (v) => (!v ? 'Please choose a workout split' : null),
};

export default function ProfileOnboardingModal({ show, onComplete, missingFields = [] }) {
  const { form, loading, dispatch, fetchProfile, saveProfile, needsFetch } = useUserProfile();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [splits, setSplits] = useState([]);
  const [errors, setErrors] = useState({});
  const [retryCount, setRetryCount] = useState(0);
  const [timeouts, setTimeouts] = useState({});

  const requiredSteps = useMemo(
    () => STEPS.filter(s => s.fields.some(f => missingFields.includes(f))),
    [missingFields]
  );
  const currentStep = requiredSteps[currentStepIndex] || {};
  const isLastStep = currentStepIndex === requiredSteps.length - 1;
  const canGoBack = currentStepIndex > 0;

  // Reset when modal closes
  useEffect(() => {
    if (!show) {
      setCurrentStepIndex(0);
      setErrors({});
      setSaving(false);
      setRetryCount(0);
      Object.values(timeouts).forEach(clearTimeout);
      setTimeouts({});
      return;
    }
    const token = localStorage.getItem('jwt_token');
    if (token && needsFetch(token)) fetchProfile(token, () => {});
  }, [show, missingFields]);

  // Fetch splits for last step
  useEffect(() => {
    if (currentStep.key === 'split' && missingFields.includes('split_id') && splits.length === 0) {
      (async () => {
        try {
          const token = localStorage.getItem('jwt_token');
          const res = await fetch(`${import.meta.env.VITE_API_URL}/schedule/v2/splits`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(res.status);
          const data = await res.json();
          setSplits(data.available_splits || []);
          if (!form.split_id && data.available_splits.length) {
            const def = data.available_splits.find(s => s.is_default) || data.available_splits[0];
            dispatch({ type: 'CHANGE_FIELD', field: 'split_id', value: def.id });
          }
        } catch {
          toast.show('danger', 'Failed to load workout options. Please try again.');
        }
      })();
    }
  }, [currentStep.key]);

  // Debounced field validation
  const validateWithDelay = (field, val) => {
    if (timeouts[field]) clearTimeout(timeouts[field]);
    const id = setTimeout(() => {
      setErrors(e => ({ ...e, [field]: VALIDATION_RULES[field]?.(val) }));
    }, 800);
    setTimeouts(t => ({ ...t, [field]: id }));
  };

  const validateStep = () => {
    const errs = {};
    currentStep.fields.filter(f => missingFields.includes(f)).forEach(f => {
      const err = VALIDATION_RULES[f]?.(form[f]);
      if (err) errs[f] = err;
    });
    setErrors(e => ({ ...e, ...errs }));
    return !Object.keys(errs).length;
  };

  const validateAll = () => {
    const allErr = {};
    requiredSteps.flatMap(s => s.fields).filter(f => missingFields.includes(f)).forEach(f => {
      const err = VALIDATION_RULES[f]?.(form[f]);
      if (err) allErr[f] = err;
    });
    if (Object.keys(allErr).length) {
      setErrors(e => ({ ...e, ...allErr }));
      toast.show('danger', 'Please fill in all required fields');
      return false;
    }
    return true;
  };

  const updateField = (field, value) => {
    dispatch({ type: 'CHANGE_FIELD', field, value });
    setErrors(e => ({ ...e, [field]: undefined }));
    if (['training_goal','training_experience','injury_caution_area','split_id'].includes(field)) {
      setErrors(e => ({ ...e, [field]: VALIDATION_RULES[field]?.(value) }));
    } else {
      validateWithDelay(field, value);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      if (!validateAll()) return;
      handleComplete();
    } else if (validateStep()) {
      setCurrentStepIndex(i => i + 1);
    }
  };
  const handleBack = () => canGoBack && setCurrentStepIndex(i => i - 1);

  const handleComplete = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) throw new Error('Authentication required');
      const prof = await saveProfile(token);
      if (!prof.success) throw new Error('Failed to save profile');
      if (missingFields.includes('split_id') && form.split_id) {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/schedule/v2/select-split/${form.split_id}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error('Failed to select workout split');
      }
      await new Promise(r => setTimeout(r, 1000));
      toast.show('success', '🎉 Welcome! Your personalized workout plan is ready!');
      onComplete?.();
    } catch (err) {
      if (retryCount < 2) {
        setRetryCount(c => c + 1);
        toast.show('warning', `Setup failed. Retrying… (${retryCount + 1}/3)`);
        setTimeout(handleComplete, 2000);
      } else {
        toast.show('danger', `Setup failed: ${err.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // FormInput component for dates/numbers & text
  const FormInput = ({ field, type = 'text', placeholder, min, max, step, children }) => {
    const global = form[field] != null ? String(form[field]) : '';
    const isDate = type === 'date';
    const isNum = type === 'number';
    const [draft, setDraft] = useState(global);

    useEffect(() => { setDraft(global); }, [global]);

    const clearErr = () => errors[field] && setErrors(e => ({ ...e, [field]: undefined }));
    const commit = () => {
      const raw = draft.trim();
      if (isDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          return setErrors(e => ({ ...e, [field]: 'Enter a complete YYYY-MM-DD' }));
        }
        updateField(field, raw);
      } else if (isNum) {
        const num = parseFloat(raw);
        if (isNaN(num)) return setErrors(e => ({ ...e, [field]: 'Enter a valid number' }));
        updateField(field, num);
      }
      const err = VALIDATION_RULES[field]?.(raw);
      if (err) setErrors(e => ({ ...e, [field]: err }));
    };

    return (
      <div className="form-group">
        <label htmlFor={field} className="form-label">{placeholder}</label>
        {isDate || isNum ? (
          <input
            id={field}
            type={type}
            className={`form-input ${errors[field] ? 'error' : ''}`}
            value={draft}
            onChange={e => { setDraft(e.target.value); clearErr(); }}
            onBlur={commit}
            min={min} max={max} step={step}
            autoComplete={isDate ? 'bday' : 'off'}
          />
        ) : (
          <div className={children ? 'input-with-unit' : ''}>
            <input
              id={field}
              type={type}
              className={`form-input ${errors[field] ? 'error' : ''}`}
              value={global}
              onChange={e => { updateField(field, e.target.value); clearErr(); }}
              onBlur={e => {
                const err = VALIDATION_RULES[field]?.(e.target.value);
                if (err) setErrors(prev => ({ ...prev, [field]: err }));
              }}
              placeholder={placeholder}
              autoComplete="off"
            />
            {children}
          </div>
        )}
        {errors[field] && <span className="error-message" role="alert">{errors[field]}</span>}
      </div>
    );
  };

  // OptionCards for selections
  const OptionCards = ({ options, selectedValue, onSelect, className = 'card-options', fieldName }) => (
    <div className="form-group">
      <div className={className} role="radiogroup" aria-labelledby={`${fieldName}-label`}>
        {options.map(opt => (
          <div
            key={opt.key}
            className={`option-card ${selectedValue === opt.key ? 'selected' : ''}`}
            onClick={() => onSelect(opt.key)}
            role="radio"
            aria-checked={selectedValue === opt.key}
            tabIndex={0}
            onKeyDown={e => { if (['Enter',' '].includes(e.key)) { e.preventDefault(); onSelect(opt.key); } }}
          >
            <div className="card-icon">{opt.icon}</div>
            <div className="card-content">
              <div className="card-title">{opt.title || opt.label}</div>
              <div className="card-description">{opt.description || opt.desc}</div>
            </div>
          </div>
        ))}
      </div>
      {errors[fieldName] && <span className="error-message" role="alert">{errors[fieldName]}</span>}
    </div>
  );

  // Cleanup on unmount
  useEffect(() => () => Object.values(timeouts).forEach(clearTimeout), [timeouts]);

  if (!show || !currentStep.key || !requiredSteps.length) return null;
  const isLoading = loading || saving;

  return (
    <div className="onboarding-fullscreen" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-container">
        <div className="onboarding-content">
          {/* Progress */}
          <div className="step-progress">
            <div className="progress-text">
              Step {currentStepIndex + 1} of {requiredSteps.length}
            </div>
            <div className="progress-bar" role="progressbar"
                 aria-valuenow={currentStepIndex + 1}
                 aria-valuemax={requiredSteps.length}
            >
              <div className="progress-fill"
                   style={{ width: `${((currentStepIndex + 1) / requiredSteps.length) * 100}%` }}
              />
            </div>
          </div>
          {/* Header */}
          <div className="step-header">
            <h1 id="onboarding-title" className="step-title">{currentStep.title}</h1>
            <p className="step-subtitle">{currentStep.subtitle}</p>
          </div>
          {/* Form */}
          <div className="step-form">
            {currentStep.key === 'about' && (
              <>
                {missingFields.includes('birthday') && (
                  <FormInput
                    field="birthday"
                    type="date"
                    placeholder="When were you born?"
                    max={new Date().toISOString().split('T')[0]}
                  />
                )}
                {missingFields.includes('height') && (
                  <FormInput
                    field="height"
                    type="number"
                    placeholder="How tall are you?"
                    min="50"
                    max="300"
                    step="0.1"
                  >
                    <select
                      className="form-select-unit"
                      value={form.height_unit || 'cm'}
                      onChange={e => updateField('height_unit', e.target.value)}
                      aria-label="Height unit"
                    >
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  </FormInput>
                )}
                {missingFields.includes('weight') && (
                  <FormInput
                    field="weight"
                    type="number"
                    placeholder="What's your current weight?"
                    min="20"
                    max="1000"
                    step="0.1"
                  >
                    <select
                      className="form-select-unit"
                      value={form.weight_unit || 'kg'}
                      onChange={e => updateField('weight_unit', e.target.value)}
                      aria-label="Weight unit"
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </FormInput>
                )}
              </>
            )}
            {currentStep.key === 'injury' && missingFields.includes('injury_caution_area') && (
              <OptionCards
                options={INJURY_OPTIONS}
                selectedValue={form.injury_caution_area}
                onSelect={v => updateField('injury_caution_area', v)}
                fieldName="injury_caution_area"
              />
            )}
            {currentStep.key === 'goal' && missingFields.includes('training_goal') && (
              <OptionCards
                options={WORKOUT_GOALS}
                selectedValue={form.training_goal}
                onSelect={v => updateField('training_goal', v)}
                className="workout-options"
                fieldName="training_goal"
              />
            )}
            {currentStep.key === 'experience' && missingFields.includes('training_experience') && (
              <OptionCards
                options={EXPERIENCE_LEVELS}
                selectedValue={form.training_experience}
                onSelect={v => updateField('training_experience', v)}
                className="experience-options"
                fieldName="training_experience"
              />
            )}
            {currentStep.key === 'split' && missingFields.includes('split_id') && (
              <div className="form-group">
                {splits.length === 0 ? (
                  <div className="loading-splits">
                    <div className="spinner-circle"></div>
                    <span>Loading workout options...</span>
                  </div>
                ) : (
                  <div className="split-options" role="radiogroup">
                    {splits.map(split => (
                      <div
                        key={split.id}
                        className={`split-card ${form.split_id == split.id ? 'selected' : ''}`}
                        onClick={() => updateField('split_id', split.id)}
                        role="radio"
                        aria-checked={form.split_id == split.id}
                        tabIndex={0}
                        onKeyDown={e => {
                          if (['Enter',' '].includes(e.key)) { e.preventDefault(); updateField('split_id', split.id); }
                        }}
                      >
                        <div className="split-header">
                          <div className="split-name">{split.name}</div>
                          {split.is_default && <span className="split-badge recommended">Recommended</span>}
                        </div>
                        {split.summary && (
                          <div className="split-summary">
                            <span className="summary-item">🗓️ {split.summary.workout_days} days/week</span>
                            <span className="summary-item">💪 {split.summary.total_exercises} exercises</span>
                            <span className="summary-item">⚡ ~{split.summary.exercises_per_day} per day</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {errors.split_id && <span className="error-message" role="alert">{errors.split_id}</span>}
              </div>
            )}
          </div>
        </div>
        {/* Navigation */}
        <div className="step-navigation">
          {canGoBack && (
            <button type="button" className="btn-back" onClick={handleBack} disabled={isLoading}>
              Back
            </button>
          )}
          <button type="button" className="btn-continue" onClick={handleNext} disabled={isLoading}>
            {isLoading ? (
              <div className="loading-spinner">
                <div className="spinner-circle"></div>
                {saving ? 'Setting up your plan...' : 'Loading...'}
              </div>
            ) : (isLastStep ? 'Complete Setup' : 'Continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
