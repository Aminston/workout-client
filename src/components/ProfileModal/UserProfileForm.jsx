import { Form } from 'react-bootstrap';
import FormField from '@/components/FormField';
import MetricInput from '@/styles/MetricInput';
const profileFields = [
  { name: 'name', label: 'Full name', type: 'text', autoFocus: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'birthday', label: 'Birthday', type: 'date' }
];

export default function UserProfileForm({
  form,
  handleChange,
  handleSubmit,
  formId
}) {
  console.log('🧪 UserProfileForm:', { form });

  return (
    <Form id={formId} onSubmit={handleSubmit}>
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

      </div>
    </Form>
  );
}
