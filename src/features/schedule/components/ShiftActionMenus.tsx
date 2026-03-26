import React from 'react';
import { Plus, Trash2, RefreshCw, CalendarX } from 'lucide-react';
import { formatHours } from '../../../utils/timeUtils';
import type { Staff, Shift, ClassType } from '../../../types';

// ── Types ──

interface OffDutyStaffInfo {
    staff: Staff;
    reason: string;
    isFullDayPref: boolean;
    isPartialPref: boolean;
    isTraining: boolean;
    timeStr: string | null;
    isOnShift: boolean;
}

// ── AddStaffMenu ──

interface AddStaffMenuProps {
    classId: ClassType;
    staffList: Staff[];
    dayShifts: Shift[];
    showAddMenu: string | null;
    onToggle: (classId: ClassType | null) => void;
    onAddStaff: (staffId: string, classType: ClassType) => void;
}

export const AddStaffMenu: React.FC<AddStaffMenuProps> = ({
    classId, staffList, dayShifts, showAddMenu, onToggle, onAddStaff
}) => {
    const available = staffList.filter(st => !dayShifts.some(s => s.staffId === st.id));

    return (
        <div className="relative">
            <button
                onClick={() => onToggle(showAddMenu === classId ? null : classId)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded border border-current transition-colors"
            >
                <Plus className="w-3 h-3" />
                追加
            </button>

            {showAddMenu === classId && (
                <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onToggle(null); }} />
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
                        {available.length === 0 ? (
                            <div className="px-3 py-2 text-[11px] text-slate-400 text-center">追加可能な従業員はいません</div>
                        ) : (
                            available.map(st => (
                                <button
                                    key={st.id}
                                    onClick={() => onAddStaff(st.id, classId)}
                                    className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                >
                                    {st.name}
                                </button>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// ── SwapStaffMenu ──

interface SwapStaffMenuProps {
    shiftId: string;
    currentStaff: Staff | undefined;
    offDutyStaff: OffDutyStaffInfo[];
    staffMonthlyHours: Record<string, number>;
    showSwapMenu: string | null;
    onToggle: (shiftId: string | null) => void;
    onSwapStaff: (oldShiftId: string, newStaffId: string) => void;
}

export const SwapStaffMenu: React.FC<SwapStaffMenuProps> = ({
    shiftId, currentStaff, offDutyStaff, staffMonthlyHours,
    showSwapMenu, onToggle, onSwapStaff
}) => {
    if (showSwapMenu !== shiftId) return null;

    const availableStaff = currentStaff
        ? offDutyStaff.filter(({ staff }) => staff.role === currentStaff.role)
        : offDutyStaff;

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onToggle(null); }} />
            <div className="absolute left-full top-0 ml-1 z-[60] w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl py-1 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700 mb-1 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 flex justify-between">
                    <span>入れ替え候補 {currentStaff ? `(${currentStaff.role})` : '(全職種)'}</span>
                    <span className="text-[8px] font-normal lowercase">月間労働時間</span>
                </div>
                {availableStaff.length === 0 ? (
                    <div className="px-3 py-4 text-[11px] text-slate-400 text-center italic">
                        {currentStaff ? '同じスタッフ区分の待機スタッフはいません' : '待機スタッフはいません'}
                    </div>
                ) : (
                    availableStaff.map(({ staff, reason, isFullDayPref, isPartialPref, isTraining, timeStr }) => {
                        const monthlyHours = formatHours(staffMonthlyHours[staff.id] || 0);
                        const target = staff.hoursTarget || 0;
                        const isOver = target > 0 && Number(monthlyHours) > target;

                        return (
                            <button
                                key={staff.id}
                                onClick={(e) => { e.stopPropagation(); onSwapStaff(shiftId, staff.id); }}
                                className="w-full text-left px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-between group/candidate"
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium group-hover/candidate:text-indigo-600 dark:group-hover/candidate:text-indigo-400">{staff.name}</span>
                                    {(reason === 'preference' || isFullDayPref || isTraining) && (
                                        <span className={`text-[8px] ${isTraining ? 'text-amber-500' : 'text-red-500'} font-bold mt-0.5 flex items-center gap-0.5`}>
                                            <CalendarX className="w-2 h-2" /> {isTraining ? '研修' : '希望休(終日)'}
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
                                        <div className="text-[8px] text-slate-400">
                                            目標: {target}h
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </>
    );
};

// ── DeleteConfirmPopup ──

interface DeleteConfirmPopupProps {
    shiftId: string;
    deleteConfirmId: string | null;
    onConfirm: (shiftId: string) => void;
    onCancel: () => void;
}

export const DeleteConfirmPopup: React.FC<DeleteConfirmPopupProps> = ({
    shiftId, deleteConfirmId, onConfirm, onCancel
}) => {
    if (deleteConfirmId !== shiftId) return null;

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onCancel(); }} />
            <div className="absolute left-full top-0 ml-1 z-[60] w-56 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 rounded-lg shadow-2xl py-3 px-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-3">
                    このシフトを削除しますか？
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onConfirm(shiftId); }}
                        className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-[11px] rounded transition-colors font-bold shadow-sm whitespace-nowrap"
                    >
                        削除
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onCancel(); }}
                        className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-[11px] rounded transition-colors font-medium border border-slate-200 dark:border-slate-600 text-center whitespace-nowrap"
                    >
                        キャンセル
                    </button>
                </div>
            </div>
        </>
    );
};

// ── ShiftRowActions (swap/delete buttons in the name cell) ──

interface ShiftRowActionsProps {
    shiftId: string;
    showSwapMenu: string | null;
    deleteConfirmId: string | null;
    onToggleSwap: (id: string | null) => void;
    onToggleDelete: (id: string | null) => void;
}

export const ShiftRowActions: React.FC<ShiftRowActionsProps> = ({
    shiftId, showSwapMenu, deleteConfirmId, onToggleSwap, onToggleDelete
}) => (
    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-20 group-hover/name:opacity-100 transition-all bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm px-0.5 py-0.5 rounded shadow border border-slate-200 dark:border-slate-700/80">
        <button
            onClick={(e) => { e.stopPropagation(); onToggleSwap(showSwapMenu === shiftId ? null : shiftId); onToggleDelete(null); }}
            className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
            title="入れ替え"
        >
            <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-3 bg-slate-200 dark:bg-slate-700"></div>
        <button
            onClick={(e) => {
                e.stopPropagation();
                onToggleDelete(deleteConfirmId === shiftId ? null : shiftId);
                onToggleSwap(null);
            }}
            className={`p-1 rounded transition-colors ${deleteConfirmId === shiftId ? 'text-red-500 bg-red-50 dark:bg-red-900/30' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
            title="削除"
        >
            <Trash2 className="w-3.5 h-3.5" />
        </button>
    </div>
);

export type { OffDutyStaffInfo };
