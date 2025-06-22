import { Modal } from 'react-bootstrap';
import './BaseModal.css';

export default function BaseModal({ show, onHide, title, children }) {
    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {children || '⚠️ No children passed to BaseModal'}
            </Modal.Body>
        </Modal>
    );
}
