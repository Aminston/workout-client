// src/components/MetricInput.jsx
import { Form } from 'react-bootstrap';

export default function MetricInput({ name, value, unitName, unitValue, onChange, step = '0.01', placeholder, unitOptions = [] }) {
  return (
    <div className="d-flex metric-input">
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
        className="ms-2"
      >
        {unitOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Form.Select>
    </div>
  );
}
