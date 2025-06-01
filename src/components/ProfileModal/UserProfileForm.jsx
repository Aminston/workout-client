import { Form } from 'react-bootstrap';
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
  { name: 'name', placeholder: 'Full name', type: 'text', autoFocus: true },
  { name: 'email', placeholder: 'Email', type: 'email' },
  { name: 'birthday', placeholder: 'Birthday', type: 'date' },
  {
    name: 'training_goal',
    placeholder: 'Training goal',
    type: 'select',
    options: trainingGoalOptions
  },
  {
    name: 'training_experience',
    placeholder: 'Experience level',
    type: 'select',
    options: trainingExperienceOptions
  },
  {
    name: 'injury_caution_area',
    placeholder: 'Injury concerns',
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
  return (
    <Form onSubmit={handleSubmit}>
      <div className="form-spaced">
        {profileFields.map(({ name, placeholder, type, autoFocus, options }) => (
          <FormField
            key={name}
            name={name}
            type={type === 'select' ? undefined : type}
            placeholder={placeholder}
            value={form[name]}
            onChange={handleChange}
            autoFocus={autoFocus}
            as={type === 'select' ? 'select' : undefined}
            options={options}
          />
        ))}

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
      </div>
    </Form>
  );
}
