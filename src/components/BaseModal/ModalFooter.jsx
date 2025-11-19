import { Button, Spinner } from 'react-bootstrap';

export default function ModalFooter({
  cancelLabel = 'Cancel',
  confirmLabel = 'Save',
  onCancel,
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false,
  confirmVariant = 'accent',
  confirmType = 'button',
  confirmForm
}) {
  return (
    <div className="modal-footer modal-footer-actions">
      <Button
        type="button"
        onClick={onCancel}
        className="btn-outline-secondary btn-modal-cancel"
      >
        {cancelLabel}
      </Button>
      <Button
        type={confirmType}
        form={confirmForm}
        onClick={onConfirm}
        disabled={confirmDisabled || confirmLoading}
        className={`btn-modal-confirm btn-${confirmVariant}`}
      >
        {confirmLoading ? <Spinner size="sm" animation="border" /> : confirmLabel}
      </Button>
    </div>
  );
}
