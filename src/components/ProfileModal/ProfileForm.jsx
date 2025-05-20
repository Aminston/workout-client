import { InputGroup, Form, Spinner } from 'react-bootstrap';
import FormField from '@/components/FormField';

function MetricInput({ name, value, unitName, unitValue, onChange, step = '0.01', placeholder, unitOptions = [] }) {
  return (
    <InputGroup className="mb-2 metric-input-group">
      <Form.Control
        type="number"
        step={step}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <Form.Select
        name={unitName}
        value={unitValue}
        onChange={onChange}
        className="metric-unit-select"
      >
        {unitOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Form.Select>
    </InputGroup>
  );
}

export default function ProfileForm({ form, isDirty, loading, handleChange }) {
  return (
    <Form>
      <div className="modal-body">
        {loading ? (
          <div className="text-center my-3">
            <Spinner animation="border" />
          </div>
        ) : (
          <fieldset disabled={loading} className="form-spaced">
            <FormField name="name" placeholder="Name" value={form.name} onChange={handleChange} autoComplete="off" />
            <FormField type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} autoComplete="off" />
            <FormField type="date" name="birthday" value={form.birthday} onChange={handleChange} />

            <MetricInput
              name="height"
              value={form.height}
              unitName="height_unit"
              unitValue={form.height_unit}
              onChange={handleChange}
              placeholder="Height"
              step="0.01"
              unitOptions={[
                { value: 'cm', label: 'cm' },
                { value: 'in', label: 'in' }
              ]}
            />

            <MetricInput
              name="weight"
              value={form.weight}
              unitName="weight_unit"
              unitValue={form.weight_unit}
              onChange={handleChange}
              placeholder="Weight"
              step="0.1"
              unitOptions={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' }
              ]}
            />

            <Form.Label>Training Goal</Form.Label>
            <Form.Select name="training_goal" value={form.training_goal} onChange={handleChange}>
              <option value="">Select goal</option>
              <option value="muscle_gain">Build Muscle</option>
              <option value="fat_loss">Lose Fat</option>
              <option value="tone_up">Tone Up</option>
              <option value="improve_strength">Build Strength</option>
              <option value="general_fitness">Improve Fitness</option>
            </Form.Select>

            <Form.Label>Training Experience</Form.Label>
            <Form.Select name="training_experience" value={form.training_experience} onChange={handleChange}>
              <option value="">Select experience</option>
              <option value="beginner">Beginner</option>
              <option value="casual">Casual Lifter</option>
              <option value="consistent">Consistent Trainer</option>
              <option value="advanced">Advanced Lifter</option>
            </Form.Select>

            <Form.Label>Injury Caution Area</Form.Label>
            <Form.Select name="injury_caution_area" value={form.injury_caution_area} onChange={handleChange}>
              <option value="none">None</option>
              <option value="shoulders">Shoulders</option>
              <option value="lower_back">Lower Back</option>
              <option value="knees">Knees</option>
              <option value="wrists">Wrists</option>
              <option value="elbows">Elbows</option>
              <option value="neck">Neck</option>
              <option value="ankles">Ankles</option>
              <option value="hips">Hips</option>
            </Form.Select>
          </fieldset>
        )}
      </div>
    </Form>
  );
}
