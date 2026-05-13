import React, { useState, useEffect } from 'react';
import { CalendarX, RefreshCw, Trash2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { toTimeStr } from '../hooks/useShiftEdit';
import type { LocalShiftData } from '../hooks/useShiftEdit';
import type { ShiftTimePattern, Staff } from '../../../types';
import { formatHours } from '../../../utils/timeUtils';
import type { OffDutyStaffInfo } from './ShiftActionMenus';

interface MobileShiftEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    staffName: string;
    currentStaff: Staff | undefined;
    localData: LocalShiftData;
    allowedPatterns: ShiftTimePattern[];
    showDutyNumbers: boolean;
    dutyValue?: number;
    dutyGroupSize?: number;
    offDutyStaff: OffDutyStaffInfo[];
    staffMonthlyHours: Record<string, number>;
    onPatternChange: (patternId: string) => void;
    onTimeChange: (field: 'start' | 'end', value: string) => void;
    onDutyNumberChange: (value: number | null) => void;
    onSwapStaff: (newStaffId: string) => void;
    onDeleteShift: () => void;
}

const MobileShiftEditModal: React.FC<MobileShiftEditModalProps> = ({
    isOpen,
    onClose,
    staffName,
    currentStaff,
    localData,
    allowedPatterns,
    showDutyNumbers,
    dutyValue,
    dutyGroupSize = 1,
    offDutyStaff,
    staffMonthlyHours,
    onPatternChange,
    onTimeChange,
    onDutyNumberChange,
    onSwapStaff,
    onDeleteShift,
}) => {
    const [startTime, setStartTime] = useState(toTimeStr(localData.start));
    const [endTime, setEndTime] = useState(toTimeStr(localData.end));
    const [showSwap, setShowSwap] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStartTime(toTimeStr(localData.start));
            setEndTime(toTimeStr(localData.end));
            setShowSwap(false);
            setConfirmDelete(false);
        }
    }, [isOpen, localData.start, localData.end]);

    const selectedPatternId = allowedPatterns.find(
        p => p.startTime === toTimeStr(localData.start) && p.endTime === toTimeStr(localData.end)
    )?.id || '';

    const dutyOptions = dutyGroupSize > 1
        ? Array.from({ length: dutyGroupSize }, (_, i) => i + 1)
        : [];

    const swapCandidates = currentStaff
        ? offDutyStaff.filter(({ staff }) => staff.role === currentStaff.role)
        : offDutyStaff;

    return (
        <Modal isOpen={isOpen} onClose={onClose} zIndex="z-[60]">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{staffName}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">シフト編集</p>
                </div>

                <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* シフトパターン */}
                    <div>
                        <label htmlFor="mobile-shift-pattern" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            シフトパターン
                        </label>
                        <select
                            id="mobile-shift-pattern"
                            className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                            value={selectedPatternId}
                            onChange={(e) => onPatternChange(e.target.value)}
                        >
                            <option value="">カスタム</option>
                            {allowedPatterns.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.startTime}〜{p.endTime})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 時間変更 */}
                    <div>
                        <p className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            時間
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                aria-label="開始時刻"
                                type="time"
                                step="900"
                                value={startTime}
                                onChange={(e) => {
                                    setStartTime(e.target.value);
                                    onTimeChange('start', e.target.value);
                                }}
                                className="flex-1 text-sm font-mono text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                            />
                            <span className="text-slate-400 text-sm">〜</span>
                            <input
                                aria-label="終了時刻"
                                type="time"
                                step="900"
                                value={endTime}
                                onChange={(e) => {
                                    setEndTime(e.target.value);
                                    onTimeChange('end', e.target.value);
                                }}
                                className="flex-1 text-sm font-mono text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* 当番番号 */}
                    {showDutyNumbers && dutyOptions.length > 0 && (
                        <div>
                            <label htmlFor="mobile-duty-number" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                当番番号
                            </label>
                            <select
                                id="mobile-duty-number"
                                className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                value={dutyValue ?? ''}
                                onChange={(e) => onDutyNumberChange(Number(e.target.value))}
                            >
                                {dutyOptions.map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* 入れ替え */}
                    <div>
                        <button
                            onClick={() => { setShowSwap(v => !v); setConfirmDelete(false); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 text-indigo-500" />
                            入れ替え
                        </button>
                        {showSwap && (
                            <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between">
                                    <span>入れ替え候補 {currentStaff ? `(${currentStaff.role})` : '(全職種)'}</span>
                                    <span className="text-[8px] font-normal lowercase">月間労働時間</span>
                                </div>
                                {swapCandidates.length === 0 ? (
                                    <div className="px-3 py-4 text-[11px] text-slate-400 text-center italic">
                                        {currentStaff ? '同じ区分の待機スタッフはいません' : '待機スタッフはいません'}
                                    </div>
                                ) : (
                                    swapCandidates.map(({ staff, reason, isFullDayPref, isPartialPref, isTraining, timeStr }) => {
                                        const monthlyHours = formatHours(staffMonthlyHours[staff.id] || 0);
                                        const target = staff.hoursTarget || 0;
                                        const isOver = target > 0 && Number(monthlyHours) > target;
                                        return (
                                            <button
                                                key={staff.id}
                                                onClick={() => { onSwapStaff(staff.id); onClose(); }}
                                                className="w-full text-left px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-between border-b border-slate-100 dark:border-slate-700 last:border-0"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{staff.name}</span>
                                                    {(reason === 'preference' || isFullDayPref || isTraining || reason === 'fixed') && (
                                                        <span className={`text-[8px] font-bold mt-0.5 flex items-center gap-0.5 ${isTraining ? 'text-amber-500' : reason === 'fixed' ? 'text-slate-500' : 'text-red-500'}`}>
                                                            <CalendarX className="w-2 h-2" />
                                                            {isTraining ? '研修' : reason === 'fixed' ? '固定休' : '希望休(終日)'}
                                                        </span>
                                                    )}
                                                    {isPartialPref && timeStr && (
                                                        <span className="text-[8px] text-red-500 font-bold mt-0.5 flex items-center gap-0.5">
                                                            <CalendarX className="w-2 h-2" /> 希望休({timeStr})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-[10px] font-mono ${isOver ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                                                        {monthlyHours}h
                                                    </div>
                                                    {target > 0 && (
                                                        <div className="text-[8px] text-slate-400">目標: {target}h</div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* 削除 */}
                    <div>
                        {!confirmDelete ? (
                            <button
                                onClick={() => { setConfirmDelete(true); setShowSwap(false); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                このシフトを削除
                            </button>
                        ) : (
                            <div className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50 dark:bg-red-900/20">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">削除しますか？</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { onDeleteShift(); onClose(); }}
                                        className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg font-bold transition-colors"
                                    >
                                        削除
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        className="flex-1 py-2 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-lg border border-slate-200 dark:border-slate-600 transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MobileShiftEditModal;
