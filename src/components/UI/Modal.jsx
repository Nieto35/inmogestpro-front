// src/components/UI/Modal.jsx
// Wrapper portal — renderiza el backdrop en document.body
// para que position:fixed siempre sea relativo al viewport,
// independiente del overflow del Layout padre.
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

const Modal = ({ children, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(13,27,62,0.55)' }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      {children}
    </div>,
    document.body
  );
};

export default Modal;
