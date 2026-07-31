import React, { useEffect, useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    zIndex?: string;
    autoFocusFirst?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    className = '',
    zIndex = 'z-50',
    autoFocusFirst = true,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
}) => {
    const mouseDownOnBackdrop = useRef(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onCloseRef.current(); return; }
            if (e.key !== 'Tab') return;
            const focusable = Array.from(
                contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', onKey);
        if (autoFocusFirst) {
            const firstFocusable = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE);
            firstFocusable?.focus();
        }
        return () => document.removeEventListener('keydown', onKey);
    }, [autoFocusFirst, isOpen]);

    if (!isOpen) return null;

    return (
        <div
            role="presentation"
            className={`fixed inset-0 ${zIndex} flex items-start sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] overflow-y-auto ${className}`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) mouseDownOnBackdrop.current = true; }}
            onMouseUp={(e) => {
                if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose();
                mouseDownOnBackdrop.current = false;
            }}
        >
            <div
                ref={contentRef}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledby}
                className="my-auto w-full flex justify-center pointer-events-none"
            >
                <div className="pointer-events-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
