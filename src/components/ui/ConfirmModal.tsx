import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Modal from './Modal';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: (checked?: boolean) => void;
    onCancel: () => void;
    variant?: 'danger' | 'info';
    isLoading?: boolean;
    checkboxLabel?: string;
    secondaryLabel?: string;
    onSecondary?: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = '実行',
    cancelLabel = 'キャンセル',
    onConfirm,
    onCancel,
    variant = 'danger',
    isLoading = false,
    checkboxLabel,
    secondaryLabel,
    onSecondary,
}) => {
    const [checked, setChecked] = useState(false);

    const confirmButtonClass = variant === 'danger'
        ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
        : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                setChecked(false);
                onCancel();
            }}
            zIndex="z-[100]"
            aria-label={title}
        >
            <div className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-6 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-xl animate-in zoom-in-95 duration-200">
                <div className="absolute right-4 top-4">
                    <button
                        onClick={() => {
                            setChecked(false);
                            onCancel();
                        }}
                        aria-label="閉じる"
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex items-start space-x-4">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${variant === 'danger' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20'}`}>
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-10">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-6">
                            {title}
                        </h3>
                        <div className="mt-3">
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                {message}
                            </p>
                            {checkboxLabel && (
                                <label className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/20 p-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => setChecked(event.target.checked)}
                                        disabled={isLoading}
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                    />
                                    <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
                                        {checkboxLabel}
                                    </span>
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            setChecked(false);
                            onCancel();
                        }}
                        disabled={isLoading}
                        className="inline-flex w-full shrink-0 whitespace-nowrap justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all sm:w-auto"
                    >
                        {cancelLabel}
                    </button>
                    {secondaryLabel && onSecondary && (
                        <button
                            type="button"
                            onClick={onSecondary}
                            disabled={isLoading}
                            className="inline-flex w-full shrink-0 whitespace-nowrap justify-center rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-all sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {secondaryLabel}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm(checked);
                        }}
                        disabled={isLoading}
                        className={`inline-flex w-full shrink-0 whitespace-nowrap justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all sm:w-auto ${confirmButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isLoading ? (
                            <div className="flex items-center space-x-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                <span>処理中...</span>
                            </div>
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
