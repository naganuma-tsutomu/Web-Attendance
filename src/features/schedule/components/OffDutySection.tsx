import React from 'react';
import { CalendarX, Plus } from 'lucide-react';
import type { ShiftClass, ClassType } from '../../../types';
import type { OffDutyStaffInfo } from './ShiftActionMenus';

interface OffDutySectionProps {
    offDutyStaff: OffDutyStaffInfo[];
    classes: ShiftClass[];
    readOnly: boolean;
    showAddMenu: string | null;
    onToggleAddMenu: (id: string | null) => void;
    onAddStaff: (staffId: string, classType: ClassType) => void;
}

const OffDutySection: React.FC<OffDutySectionProps> = ({
    offDutyStaff, classes, readOnly, showAddMenu, onToggleAddMenu, onAddStaff
}) => (
    <div className="mt-6 pb-4 px-4">
        <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/50"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">本日のお休み</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/50"></div>
        </div>

        <div className="flex flex-wrap gap-2">
            {offDutyStaff.length === 0 ? (
                <div className="w-full text-center py-4 text-xs text-slate-400 italic">
                    全員シフトに入っています
                </div>
            ) : (
                offDutyStaff.map(({ staff, reason, isFullDayPref, isPartialPref, isTraining, timeStr, isOnShift }) => (
                    <div key={staff.id} className="relative">
                        <button
                            onClick={() => !readOnly && !isOnShift && onToggleAddMenu(showAddMenu === staff.id ? null : staff.id)}
                            disabled={readOnly || isOnShift}
                            className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[11px] font-medium ${
                                isOnShift
                                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 opacity-90 cursor-default'
                                    : isTraining
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                                        : reason === 'preference' || isPartialPref
                                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                            } ${!isOnShift && !readOnly ? (isTraining) ? 'hover:bg-amber-100 dark:hover:bg-amber-900/40' : (reason === 'preference' || isPartialPref) ? 'hover:bg-red-100 dark:hover:bg-red-900/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}`}
                        >
                            {(reason === 'preference' || isPartialPref || isTraining) && <CalendarX className="w-3 h-3 opacity-70" />}
                            <span>{staff.name}</span>
                            {(reason === 'preference' || isFullDayPref || isTraining) && (
                                <span className={`text-[9px] ${isTraining ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/50'} px-1 rounded`}>
                                    {isTraining ? '研修' : '希望休(終日)'}
                                </span>
                            )}
                            {isPartialPref && timeStr && !isTraining && (
                                <span className="text-[9px] bg-red-100 dark:bg-red-900/50 px-1 rounded">希望休({timeStr})</span>
                            )}
                            {isOnShift && (
                                <span className="text-[9px] bg-orange-100 dark:bg-orange-900/50 px-1 rounded font-bold">※シフトあり</span>
                            )}
                            {!readOnly && !isOnShift && (
                                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                            )}
                        </button>

                        {!readOnly && !isOnShift && showAddMenu === staff.id && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onToggleAddMenu(null); }} />
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700 mb-1">
                                        追加先のクラスを選択
                                    </div>
                                    {classes.map(cls => (
                                        <button
                                            key={cls.id}
                                            onClick={() => onAddStaff(staff.id, cls.id)}
                                            className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-between group/cls"
                                        >
                                            <span>{cls.name}</span>
                                            <Plus className="w-3 h-3 text-indigo-500 opacity-0 group-hover/cls:opacity-100" />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ))
            )}
        </div>
    </div>
);

export default OffDutySection;
