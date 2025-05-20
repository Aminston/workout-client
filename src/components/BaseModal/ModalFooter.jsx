import { Button, Spinner } from 'react-bootstrap';

export default function ModalFooter({
  cancelLabel = 'Cancel',
  confirmLabel = 'Save',
  onCancel,
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false
}) {
  return (
    <div className="modal-footer modal-footer-actions">
      <Button
        onClick={onCancel}
        className="btn-modal-cancel"
      >
        {cancelLabel}
      </Button>
      <Button
        onClick={onConfirm}
        disabled={confirmDisabled || confirmLoading}
        className="btn-modal-confirm"
      >
        {confirmLoading ? <Spinner size="sm" animation="border" /> : confirmLabel}
      </Button>
    </div>
  );
}
