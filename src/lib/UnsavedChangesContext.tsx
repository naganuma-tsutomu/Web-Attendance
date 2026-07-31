import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Modal from '../components/ui/Modal';

interface UnsavedGuard {
    dirty: boolean;
    save: () => Promise<void>;
    discard: () => void;
}

interface UnsavedChangesValue {
    setGuard: (guard: UnsavedGuard | null) => void;
    requestTransition: (transition: () => void | Promise<void>) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesValue | null>(null);

export const UnsavedChangesProvider = ({ children }: { children: React.ReactNode }) => {
    const [guard, setGuard] = useState<UnsavedGuard | null>(null);
    const [pendingTransition, setPendingTransition] = useState<(() => void | Promise<void>) | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (!guard?.dirty) return;
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [guard?.dirty]);

    const requestTransition = useCallback((transition: () => void | Promise<void>) => {
        if (!guard?.dirty) {
            void transition();
            return;
        }
        setSaveError(null);
        setPendingTransition(() => transition);
    }, [guard]);

    const finishTransition = async () => {
        const transition = pendingTransition;
        setPendingTransition(null);
        if (transition) await transition();
    };

    const handleSave = async () => {
        if (!guard) return;
        setSaving(true);
        setSaveError(null);
        try {
            await guard.save();
            await finishTransition();
        } catch (error) {
            setSaveError(error instanceof Error && error.message ? error.message : '保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        guard?.discard();
        await finishTransition();
    };

    return (
        <UnsavedChangesContext.Provider value={{ setGuard, requestTransition }}>
            {children}
            <Modal
                isOpen={pendingTransition !== null}
                onClose={() => setPendingTransition(null)}
                aria-labelledby="unsaved-changes-title"
                zIndex="z-[110]"
            >
                <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-2xl">
                    <h2 id="unsaved-changes-title" className="text-lg font-bold text-slate-900 dark:text-white">
                        未保存の変更があります
                    </h2>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                        日別タイムラインの変更を保存してから移動しますか？
                    </p>
                    {saveError && <p role="alert" className="mt-3 text-sm text-red-600">{saveError}</p>}
                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => setPendingTransition(null)}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 dark:border-slate-600 dark:text-slate-300"
                        >
                            キャンセル
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleDiscard()}
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 dark:border-red-800"
                        >
                            破棄して移動
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleSave()}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                            {saving ? '保存中...' : '保存して移動'}
                        </button>
                    </div>
                </div>
            </Modal>
        </UnsavedChangesContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUnsavedChanges = () => {
    const value = useContext(UnsavedChangesContext);
    if (!value) throw new Error('useUnsavedChanges must be used within UnsavedChangesProvider');
    return value;
};
