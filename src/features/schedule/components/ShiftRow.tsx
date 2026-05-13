import React from 'react';
import type { BreakSettings, DynamicRole, Shift, Staff, ShiftTimePattern } from '../../../types';
import type { LocalShiftData, DragType, BusinessHoursConfig } from '../hooks/useShiftEdit';
import TimelineBar from './TimelineBar';
import { SwapStaffMenu, DeleteConfirmPopup, ShiftRowActions, type OffDutyStaffInfo } from './ShiftActionMenus';
import DutyNumberCell from './DutyNumberCell';
import { toTimeStr } from '../hooks/useShiftEdit';
import { calculateActualWorkingHours, calculateDuration } from '../../../utils/timeUtils';

interface ShiftRowProps {
    shift: Shift;
    staff: Staff | undefined;
    staffName: string;
    localData: LocalShiftData;
    isDragging: boolean;
    dragDeltaY: number;
    hoveredGroup: string | 'unassigned' | null;
    readOnly: boolean;
    showDutyNumbers: boolean;
    highlightStaffId?: string;
    conflictType: 'training' | 'preference' | 'none';
    classColorMap: Record<string, string>;
    timePatterns: ShiftTimePattern[];
    roles: DynamicRole[];
    breakSettings?: BreakSettings;
    hours: BusinessHoursConfig;
    onPointerDown: (e: React.PointerEvent, id: string, type: DragType, trackEl: HTMLElement) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    renderGridLines: () => React.ReactNode;
    showSwapMenu: string | null;
    deleteConfirmId: string | null;
    onToggleSwap: (id: string | null) => void;
    onToggleDelete: (id: string | null) => void;
    onSwapStaff: (oldId: string, newId: string) => void;
    onRemoveShift: (id: string) => void;
    onDutyNumberUpdate: (id: string, value: number | null) => void;
    onPatternChange: (id: string, patternId: string) => void;
    onTimeChange: (id: string, field: 'start' | 'end', value: string) => void;
    onMobileEdit: (id: string) => void;
    groupShiftsCount: number;
    effectiveDutyNumber: number;
    isDutyAuto: boolean;
    offDutyStaff: OffDutyStaffInfo[];
    staffMonthlyHours: Record<string, number>;
}

const ShiftRow: React.FC<ShiftRowProps> = ({
    shift, staff, staffName, localData, isDragging, dragDeltaY, hoveredGroup,
    readOnly, showDutyNumbers, highlightStaffId, conflictType,
    classColorMap, timePatterns, roles, breakSettings, hours, onPointerDown, onPointerUp, renderGridLines,
    showSwapMenu, deleteConfirmId, onToggleSwap, onToggleDelete,
    onSwapStaff, onRemoveShift, onDutyNumberUpdate, onPatternChange, onTimeChange, onMobileEdit,
    groupShiftsCount, effectiveDutyNumber, isDutyAuto, offDutyStaff, staffMonthlyHours
}) => {
    const startTime = toTimeStr(localData.start);
    const endTime = toTimeStr(localData.end);
    const allowedPatterns = roles.find(role => role.name === staff?.role)?.patterns || [];
    const matchedPattern = allowedPatterns.find(pattern => pattern.startTime === startTime && pattern.endTime === endTime);
    const durationHours = breakSettings?.displayActualHoursInModal
        ? calculateActualWorkingHours(startTime, endTime, breakSettings)
        : calculateDuration(startTime, endTime);
    const durationMins = Math.round(durationHours * 60);
    const durationLabel = `${Math.floor(durationMins / 60)}:${String(durationMins % 60).padStart(2, '0')}`;

    return (
        <div
            className={`flex flex-row ${readOnly ? 'items-center border-b border-slate-100 dark:border-slate-700/50' : 'border-b border-slate-200 dark:border-slate-700'} ${isDragging ? 'opacity-40 bg-slate-100 dark:bg-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
            style={readOnly ? { touchAction: 'pan-y' } : {}}
        >
            {/* Left Info Column */}
            {!readOnly ? (
                <div className={`flex flex-col sm:flex-row w-[110px] ${showDutyNumbers ? 'sm:w-[512px]' : 'sm:w-[480px]'} flex-shrink-0 text-xs sm:text-sm bg-white dark:bg-slate-800`}>
                    {showDutyNumbers && (
                        <DutyNumberCell
                            shiftId={shift.id}
                            value={effectiveDutyNumber}
                            isAuto={isDutyAuto}
                            groupSize={groupShiftsCount}
                            onUpdate={onDutyNumberUpdate}
                        />
                    )}
                    <div className="w-full sm:w-28 min-h-[52px] sm:min-h-0 p-1 sm:p-2 border-b sm:border-b-0 border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center relative group/name">
                        {/* Mobile view */}
                        <div className="flex sm:hidden items-center justify-between gap-1">
                            <div className="font-medium text-[11px] text-slate-800 dark:text-slate-200 truncate flex items-center gap-1" title={staffName}>
                                {staffName}
                                {highlightStaffId === shift.staffId && (
                                    <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter flex-shrink-0">My</span>
                                )}
                            </div>
                            <button
                                onClick={() => onMobileEdit(shift.id)}
                                className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded font-medium"
                            >
                                編集
                            </button>
                        </div>
                        <div className="flex sm:hidden text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {toTimeStr(localData.start)}〜{toTimeStr(localData.end)}
                        </div>

                        {/* Desktop view */}
                        <div className="hidden sm:block font-medium text-[13px] text-slate-800 dark:text-slate-200 truncate pr-1" title={staffName}>
                            {staffName}
                            {highlightStaffId === shift.staffId && (
                                <span className="ml-1 text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">My</span>
                            )}
                        </div>
                        <ShiftRowActions
                            shiftId={shift.id}
                            showSwapMenu={showSwapMenu}
                            deleteConfirmId={deleteConfirmId}
                            onToggleSwap={onToggleSwap}
                            onToggleDelete={onToggleDelete}
                        />
                        <DeleteConfirmPopup
                            shiftId={shift.id}
                            deleteConfirmId={deleteConfirmId}
                            onConfirm={onRemoveShift}
                            onCancel={() => onToggleDelete(null)}
                        />
                        <SwapStaffMenu
                            shiftId={shift.id}
                            currentStaff={staff}
                            offDutyStaff={offDutyStaff}
                            staffMonthlyHours={staffMonthlyHours}
                            showSwapMenu={showSwapMenu}
                            onToggle={onToggleSwap}
                            onSwapStaff={onSwapStaff}
                        />
                    </div>
                    <div className="hidden sm:flex w-36 p-1.5 border-r border-slate-200 dark:border-slate-700 items-center">
                        <select
                            value={matchedPattern?.id ?? ''}
                            onChange={(e) => onPatternChange(shift.id, e.target.value)}
                            className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded pl-1 pr-5 py-0.5 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                            aria-label={`${staffName}のシフトパターン`}
                        >
                            {!matchedPattern && <option value="">カスタム</option>}
                            {allowedPatterns.map(pattern => (
                                <option key={pattern.id} value={pattern.id}>
                                    {pattern.name} ({pattern.startTime}-{pattern.endTime})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="hidden sm:flex w-20 p-1.5 border-r border-slate-200 dark:border-slate-700 items-center">
                        <input
                            type="time"
                            step={900}
                            value={startTime}
                            onChange={(e) => onTimeChange(shift.id, 'start', e.target.value)}
                            className="w-full text-center text-xs font-mono text-slate-700 dark:text-slate-300 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text"
                            aria-label={`${staffName}の開始時刻`}
                        />
                    </div>
                    <div className="hidden sm:flex w-20 p-1.5 border-r border-slate-200 dark:border-slate-700 items-center">
                        <input
                            type="time"
                            step={900}
                            value={endTime}
                            onChange={(e) => onTimeChange(shift.id, 'end', e.target.value)}
                            className="w-full text-center text-xs font-mono text-slate-700 dark:text-slate-300 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text"
                            aria-label={`${staffName}の終了時刻`}
                        />
                    </div>
                    <div className="hidden sm:flex w-14 p-2 border-r border-slate-200 dark:border-slate-700 items-center justify-center text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                        {durationLabel}
                    </div>
                </div>
            ) : (
                <div className="w-[100px] sm:w-[140px] flex-shrink-0 p-1 sm:p-2 border-r border-slate-100 dark:border-slate-800 flex items-center">
                    <div className={`font-medium truncate transition-colors text-xs sm:text-sm ${highlightStaffId === shift.staffId ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`} title={staffName}>
                        {staffName}
                    </div>
                </div>
            )}

            {/* Timeline Track */}
            <TimelineBar
                shift={shift}
                localData={localData}
                isDragging={isDragging}
                dragDeltaY={dragDeltaY}
                hoveredGroup={hoveredGroup as any}
                highlightStaffId={highlightStaffId}
                readOnly={readOnly}
                classColorMap={classColorMap}
                timePatterns={timePatterns}
                hours={hours}
                conflictType={conflictType}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                renderGridLines={renderGridLines}
            />
        </div>
    );
};

export default ShiftRow;
