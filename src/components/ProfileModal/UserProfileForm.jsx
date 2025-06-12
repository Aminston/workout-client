import { Form, Button, Spinner } from 'react-bootstrap';
import FormField from '@/components/FormField';
import MetricInput from '@/styles/MetricInput';
import {
  TRAINING_GOALS,
  EXPERIENCE_LEVELS,
  INJURY_AREAS
} from '../../../constants/enums';

const trainingGoalOptions = TRAINING_GOALS.map(opt => ({
  value: opt.key,
  label: opt.label
}));

const trainingExperienceOptions = EXPERIENCE_LEVELS.map(opt => ({
  value: opt.key,
  label: opt.label
}));

const injuryCautionOptions = INJURY_AREAS.map(opt => ({
  value: opt.key,
  label: opt.label
}));

const profileFields = [
  { name: 'name', label: 'Full name', type: 'text', autoFocus: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'birthday', label: 'Birthday', type: 'date' },
  {
    name: 'training_goal',
    label: 'Training goal',
    type: 'select',
    options: trainingGoalOptions
  },
  {
    name: 'training_experience',
    label: 'Experience level',
    type: 'select',
    options: trainingExperienceOptions
  },
  {
    name: 'injury_caution_area',
    label: 'Injury concerns',
    type: 'select',
    options: injuryCautionOptions
  }
];

export default function UserProfileForm({
  form,
  isDirty,
  isValid,
  loading,
  handleChange,
  handleSubmit,
  handleCancel
}) {
  console.log('🧪 UserProfileForm:', { isDirty, isValid, loading, form }); // <-- ADD THIS

  return (
    <Form onSubmit={handleSubmit}>
      <div className="form-spaced">
        {profileFields.map(({ name, label, type, autoFocus, options }) => (
          <Form.Group key={name} className="mb-3">
            <Form.Label>{label}</Form.Label>
            <FormField
              name={name}
              type={type === 'select' ? undefined : type}
              value={form[name]}
              onChange={handleChange}
              autoFocus={autoFocus}
              as={type === 'select' ? 'select' : undefined}
              options={options}
            />
          </Form.Group>
        ))}

        <Form.Group className="mb-3">
          <Form.Label>Height</Form.Label>
          <MetricInput
            name="height"
            value={form.height}
            unitName="height_unit"
            unitValue={form.height_unit}
            onChange={handleChange}
            placeholder="Height"
            unitOptions={[
              { value: 'cm', label: 'cm' },
              { value: 'in', label: 'inches' }
            ]}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Weight</Form.Label>
          <MetricInput
            name="weight"
            value={form.weight}
            unitName="weight_unit"
            unitValue={form.weight_unit}
            onChange={handleChange}
            placeholder="Weight"
            unitOptions={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lbs' }
            ]}
          />
        </Form.Group>

        <div className="modal-footer modal-footer-actions mt-3">
          <Button type="button" onClick={handleCancel} className="btn-outline-secondary btn-modal-cancel">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || loading}
            className="btn-modal-confirm btn-accent"
          >
            {loading ? <Spinner size="sm" animation="border" /> : 'Save'}
          </Button>
        </div>
      </div>
    </Form>
  );
}
