import { Form } from 'react-bootstrap';
import FormField from '@/components/FormField';
import MetricInput from '@/styles/MetricInput';

const profileFields = [
  { name: 'name', placeholder: 'Full name', type: 'text', autoFocus: true },
  { name: 'email', placeholder: 'Email', type: 'email' },
  { name: 'birthday', placeholder: 'Birthday', type: 'date' },
  { name: 'background', placeholder: 'Training background' },
  { name: 'training_goal', placeholder: 'Training goal' },
  { name: 'training_experience', placeholder: 'Experience level' },
  { name: 'injury_caution_area', placeholder: 'Injury concerns' }
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
        {profileFields.map(({ name, placeholder, type, autoFocus }) => (
          <FormField
            key={name}
            name={name}
            type={type}
            placeholder={placeholder}
            value={form[name]}
            onChange={handleChange}
            autoFocus={autoFocus}
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
