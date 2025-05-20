import { Modal } from 'react-bootstrap';
import ModalFooter from './ModalFooter';
import './BaseModal.css';

export default function BaseModal({
  show,
  onHide,
  title,
  children,
  onCancel,
  onSubmit,
  canSubmit = true,
  isSubmitting = false,
  cancelLabel = 'Cancel',
  confirmLabel = 'Save',
  confirmVariant = 'accent'
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <div>{children}</div>
      <ModalFooter
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        onCancel={onCancel || onHide}
        onConfirm={onSubmit}
        confirmDisabled={!canSubmit}
        confirmLoading={isSubmitting}
        confirmVariant={confirmVariant}
      />
    </Modal>
  );
}