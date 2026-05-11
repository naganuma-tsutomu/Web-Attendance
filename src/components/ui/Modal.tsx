import React, { useEffect, useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    zIndex?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    className = '',
    zIndex = 'z-50',
}) => {
    const mouseDownOnBackdrop = useRef(false);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 ${zIndex} flex items-start sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] overflow-y-auto ${className}`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) mouseDownOnBackdrop.current = true; }}
            onMouseUp={(e) => {
                if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose();
                mouseDownOnBackdrop.current = false;
            }}
        >
            <div className="my-auto w-full flex justify-center">
                {children}
            </div>
        </div>
    );
};

export default Modal;
