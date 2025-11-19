import { Modal } from 'react-bootstrap';
import './BaseModal.css';

export default function BaseModal({ show, onHide, title, children, footer }) {
  return (
    <Modal show={show} onHide={onHide} centered dialogClassName="base-modal">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{children || '⚠️ No children passed to BaseModal'}</Modal.Body>
      {footer && <Modal.Footer className="modal-footer-actions">{footer}</Modal.Footer>}
    </Modal>
  );
}