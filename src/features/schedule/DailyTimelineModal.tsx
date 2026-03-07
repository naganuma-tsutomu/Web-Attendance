import React, { useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { X, Save } from 'lucide-react';
import type { Shift, Staff, ShiftClass, ShiftTimePattern } from '../../types';
import DailyTimelineView from './DailyTimelineView';

interface DailyTimelineModalProps {
    date: Date;
    shifts: Shift[];
    staffList: Staff[];
    classes: ShiftClass[];
    timePatterns: ShiftTimePattern[];
    onClose: () => void;
    onShiftUpdate?: () => void;
}

const DailyTimelineModal: React.FC<DailyTimelineModalProps> = ({
    date,
    shifts,
    staffList,
    classes,
    timePatterns,
    onClose,
    onShiftUpdate
}) => {
    const [savingAll, setSavingAll] = useState(false);
    const [isModified, setIsModified] = useState(false);
    const saveRef = useRef<(() => Promise<void>) | null>(null);

    const handleSave = async () => {
        if (!saveRef.current) return;
        setSavingAll(true);
        try {
            await saveRef.current();
            onClose();
        } catch (error) {
            alert('保存に失敗しました。');
        } finally {
            setSavingAll(false);
        }
    };

    const handleClose = useCallback(() => {
        if (isModified) {
            if (window.confirm('変更が保存されていません。変更を破棄してよろしいですか？')) {
                onClose();
            }
        } else {
            onClose();
        }
    }, [isModified, onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-auto select-none"
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
            }}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-6xl flex flex-col animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700"
                style={{ maxHeight: 'calc(100vh - 4rem)' }}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 rounded-t-2xl flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                            {format(date, 'yyyy年M月d日 (E)', { locale: ja })}
                            <span className="text-slate-500 dark:text-slate-400 text-base font-normal ml-2">のタイムライン</span>
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            バーをドラッグ・または左の入力欄で時間を変更できます（15分スナップ）
                        </p>
                    </div>
                    <button onClick={handleClose} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 min-h-0 flex flex-col">
                    <DailyTimelineView
                        date={date}
                        shifts={shifts}
                        staffList={staffList}
                        classes={classes}
                        timePatterns={timePatterns}
                        onShiftUpdate={onShiftUpdate}
                        onModifiedChange={setIsModified}
                        saveRef={saveRef}
                    />

                    {/* Footer Buttons */}
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-end gap-3 text-xs">
                        {isModified && (
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mr-4">
                                <Save className="w-4 h-4" />
                                <span className="font-medium">変更後は「保存する」ボタンで確定してください</span>
                            </div>
                        )}
                        <button
                            onClick={handleClose}
                            disabled={savingAll}
                            className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={savingAll || !isModified}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95"
                        >
                            {savingAll ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    保存中...
                                </>
                            ) : (
                                <>
                                    <Save className="w-3.5 h-3.5" />
                                    保存する
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default DailyTimelineModal;
