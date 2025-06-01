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
  console.log('🧪 BaseModal children:', children);

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div >
          {children || '⚠️ No children passed to BaseModal'}
        </div>
      </Modal.Body>

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
