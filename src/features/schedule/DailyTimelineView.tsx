import React, { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Lock, Unlock } from 'lucide-react';
import { useBusinessHours } from '../../lib/hooks';
import { isStaffAvailableReason } from '../../lib/algorithm';
import { calculateDuration as calculateDurationHours, timeToMinutes } from '../../utils/timeUtils';
import { useShiftEdit, toTimeStr, resolveBusinessHours } from './hooks/useShiftEdit';
import type { LocalShiftData } from './hooks/useShiftEdit';
import { useTimelineDrag } from './hooks/useTimelineDrag';
import TimelineBar, { hexToRgba } from './components/TimelineBar';
import { AddStaffMenu, SwapStaffMenu, DeleteConfirmPopup, ShiftRowActions } from './components/ShiftActionMenus';
import type { OffDutyStaffInfo } from './components/ShiftActionMenus';
import OffDutySection from './components/OffDutySection';
import type { Shift, Staff, ClassType, ShiftClass, ShiftTimePattern, DynamicRole, ShiftPreference } from '../../types';

interface DailyTimelineViewProps {
    date: Date;
    shifts: Shift[];
    staffList: Staff[];
    classes: ShiftClass[];
    timePatterns: ShiftTimePattern[];
    roles: DynamicRole[];
    preferences?: ShiftPreference[];
    onShiftUpdate?: () => void;
    onModifiedChange?: (modified: boolean) => void;
    saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
    readOnly?: boolean;
    isFixed?: boolean;
    onToggleFixed?: () => void;
    hideHeaderToggle?: boolean;
    highlightStaffId?: string;
}

const DailyTimelineView: React.FC<DailyTimelineViewProps> = ({
    date, shifts, staffList, classes, timePatterns, roles,
    preferences = [], onShiftUpdate, onModifiedChange, saveRef,
    readOnly = false, isFixed = false, onToggleFixed, hideHeaderToggle, highlightStaffId
}) => {
    // ── Business hours ──
    const { data: businessHoursData } = useBusinessHours();
    const hours = useMemo(() => resolveBusinessHours(businessHoursData), [businessHoursData]);

    const edit = useShiftEdit({
        shifts, date, staffList, timePatterns, hours, onShiftUpdate, onModifiedChange, saveRef
    });
    const { localShifts, addedShifts, deletedIds, targetDateStr } = edit;

    // ── Menu state ──
    const [showAddMenu, setShowAddMenu] = useState<string | null>(null);
    const [showSwapMenu, setShowSwapMenu] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // ── Drag state ──
    const {
        activeDragId,
        dragDeltaY,
        hoveredGroup,
        groupRefs,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    } = useTimelineDrag({ localShifts: edit.localShifts, classes, hours, readOnly, dispatch: edit.dispatch });

    // ── Derived data ──
    const hourLabels = useMemo(() =>
        Array.from({ length: (hours.endHour - hours.startHour) + 1 }, (_, i) => hours.startHour + i),
    [hours]);

    const dayShifts = useMemo<Shift[]>(() => {
        return [...shifts.filter(s => s.date === targetDateStr), ...addedShifts]
            .filter(s => !deletedIds.has(s.id))
            .sort((a, b) => {
                if (a.classType !== b.classType) return a.classType.localeCompare(b.classType);
                const indexA = staffList.findIndex(s => s.id === a.staffId);
                const indexB = staffList.findIndex(s => s.id === b.staffId);
                if (indexA !== -1 && indexB !== -1) {
                    if (indexA !== indexB) return indexA - indexB;
                } else if (indexA !== -1) return -1;
                else if (indexB !== -1) return 1;
                return a.startTime.localeCompare(b.startTime);
            });
    }, [shifts, targetDateStr, addedShifts, deletedIds, staffList]);

    const targetYearMonth = format(date, 'yyyy-MM');

    const staffMonthlyHours = useMemo(() => {
        const hrs: Record<string, number> = {};
        const base = shifts.filter(s =>
            s.date.startsWith(targetYearMonth) && !deletedIds.has(s.id) && s.staffId !== 'UNASSIGNED'
        );
        const added = addedShifts.filter(s =>
            s.date.startsWith(targetYearMonth) && s.staffId !== 'UNASSIGNED'
        );
        [...base, ...added].forEach(s => {
            const duration = calculateDurationHours(s.startTime, s.endTime);
            hrs[s.staffId] = (hrs[s.staffId] || 0) + duration;
        });
        return hrs;
    }, [shifts, addedShifts, deletedIds, targetYearMonth]);

    const offDutyStaff = useMemo<OffDutyStaffInfo[]>(() => {
        return staffList
            .map(staff => {
                const isOnShift = dayShifts.some(s => s.staffId === staff.id);
                const reason = isStaffAvailableReason(staff, date, targetDateStr, preferences);

                let isFullDayPref = false;
                let isPartialPref = false;
                let timeStr: string | null = null;
                let isTraining = false;

                const pref = preferences.find(p => p.staffId === staff.id);
                if (pref?.details?.length) {
                    const detail = pref.details.find(d => d.date === targetDateStr);
                    if (detail) {
                        if (detail.type === 'training') isTraining = true;
                        else if (!detail.startTime && !detail.endTime) isFullDayPref = true;
                        else if (detail.startTime && detail.endTime) {
                            isPartialPref = true;
                            timeStr = `${detail.startTime}-${detail.endTime}`;
                        }
                    }
                }

                const hasPreference = isFullDayPref || isPartialPref || isTraining || reason === 'preference';
                if (!isOnShift || hasPreference) {
                    return { staff, reason, isFullDayPref, isPartialPref, isTraining, timeStr, isOnShift };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [staffList, dayShifts, date, targetDateStr, preferences]);

    const classColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        classes.forEach(c => { if (c.color) map[c.id] = c.color; });
        return map;
    }, [classes]);

    // ── Conflict helper ──
    const getShiftConflictType = (staffId: string, shiftStartMins: number, shiftEndMins: number): 'training' | 'preference' | 'none' => {
        const pref = preferences.find(p => p.staffId === staffId);
        if (!pref?.details?.length) return 'none';
        const detail = pref.details.find(d => d.date === targetDateStr);
        if (!detail) return 'none';
        if (detail.type === 'training') return 'training';
        if (!detail.startTime && !detail.endTime) return 'preference';
        if (detail.startTime && detail.endTime) {
            const prefStart = timeToMinutes(detail.startTime);
            const prefEnd = timeToMinutes(detail.endTime);
            if (shiftStartMins < prefEnd && shiftEndMins > prefStart) return 'preference';
        }
        return 'none';
    };

    const calculateDuration = (startMins: number, endMins: number) => {
        const diff = endMins - startMins;
        if (diff < 0) return '??';
        return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
    };

    // ── Grid lines ──
    const renderGridLines = useCallback(() => {
        const lines = [];
        const totalSlots = (hours.endHour - hours.startHour) * 4;
        for (let i = 0; i <= totalSlots; i++) {
            const currentMins = hours.startHour * 60 + i * 15;
            const isHour = i % 4 === 0;
            const isHalf = i % 2 === 0 && !isHour;
            const leftOffset = ((currentMins - hours.displayStartMins) / hours.displayTotalMins) * 100;
            lines.push(
                <div
                    key={i}
                    className={`absolute top-0 bottom-0 border-l z-0 pointer-events-none ${isHour
                        ? 'border-slate-300 dark:border-slate-600'
                        : isHalf
                            ? 'border-slate-200 dark:border-slate-700 border-dashed'
                            : 'border-slate-100 dark:border-slate-800'
                    }`}
                    style={{ left: `${leftOffset}%` }}
                />
            );
        }
        return lines;
    }, [hours]);

    // ── Class group color helper (DB color フィールドのみ使用) ──
    const getDynamicColor = (classId: string) => {
        if (classId === 'unassigned') {
            return 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700';
        }
        // DB の color が存在しない / 取得できていない場合のニュートラルフォールバック
        return 'text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700';
    };

    // ── Add from OffDutySection ──
    const handleAddFromOffDuty = (staffId: string, classType: ClassType) => {
        edit.handleAddStaff(staffId, classType);
        setShowAddMenu(null);
    };

    return (
        <div
            className={`select-none ${activeDragId ? 'touch-none' : 'touch-pan-y'} flex-shrink-0 flex flex-col ${readOnly ? '' : 'flex-1 overflow-auto min-h-0'}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {!readOnly && onToggleFixed && !hideHeaderToggle && (
                <div className="flex justify-end p-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onToggleFixed}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border shadow-sm ${
                            isFixed
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                    >
                        {isFixed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        <span>{isFixed ? '自動生成からロック中' : 'シフトをロックする'}</span>
                    </button>
                </div>
            )}

            <div className="min-w-full md:min-w-[800px] overflow-visible flex flex-col bg-white dark:bg-slate-800">
                {/* Header Row */}
                {!readOnly && (
                    <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 sticky top-0 z-20">
                        <div className="hidden sm:flex w-[480px] flex-shrink-0">
                            <div className="w-28 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">名前</div>
                            <div className="w-36 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">シフトパターン</div>
                            <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">開始</div>
                            <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">終了</div>
                            <div className="w-14 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">時間</div>
                        </div>
                        <div className="sm:hidden w-24 flex-shrink-0 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">スタッフ</div>
                        <div className="flex-1 relative h-8 border-l border-slate-300 dark:border-slate-600">
                            {hourLabels.map((h) => {
                                const leftPct = ((h * 60 - hours.displayStartMins) / hours.displayTotalMins) * 100;
                                return (
                                    <React.Fragment key={h}>
                                        <div className="absolute top-0 bottom-0 border-l border-slate-300/50 dark:border-slate-600/50" style={{ left: `${leftPct}%` }} />
                                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-0.5 z-10" style={{ left: `${leftPct}%` }}>{h}</div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Simplified readOnly header */}
                {readOnly && (
                    <div className="flex bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 sticky top-0 z-20">
                        <div className="w-44 flex-shrink-0 p-1.5 border-r border-slate-200 dark:border-slate-700 text-center">名前 / 時間</div>
                        <div className="flex-1 relative h-6">
                            {hourLabels.map((h) => {
                                const leftPct = ((h * 60 - hours.displayStartMins) / hours.displayTotalMins) * 100;
                                return (
                                    <div key={h} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[9px] text-slate-400" style={{ left: `${leftPct}%` }}>{h}</div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Content Rows */}
                <div className="pb-2">
                    {[...classes, { id: 'unassigned', name: '未割り当て' } as ShiftClass].map(cls => {
                        const groupShifts = dayShifts.filter(shift => {
                            const local = localShifts[shift.id];
                            const currentClassId = local ? local.classType : shift.classType;
                            const isError = local ? local.isError : shift.isError;
                            if (cls.id === 'unassigned') return (isError || !classes.some(c => c.id === currentClassId));
                            return currentClassId === cls.id && !isError;
                        });

                        if (groupShifts.length === 0 && (cls.id === 'unassigned' || readOnly)) return null;

                        const groupTitle = cls.name;
                        const titleColor = getDynamicColor(cls.id);
                        const titleCustomStyle = cls.color && hoveredGroup !== cls.id ? {
                            backgroundColor: hexToRgba(cls.color, 0.12),
                            borderColor: hexToRgba(cls.color, 0.25),
                        } : {};

                        return (
                            <div
                                key={cls.id}
                                ref={el => { groupRefs.current[cls.id] = el; }}
                                className={`mb-2 last:mb-0 border border-slate-200 dark:border-slate-700 shadow-sm relative ${
                                    dayShifts.some(s => (showSwapMenu === s.id || deleteConfirmId === s.id) && (localShifts[s.id]?.classType === cls.id || (s.classType === cls.id && !localShifts[s.id]))) || showAddMenu === cls.id
                                    ? 'z-50 overflow-visible' : 'z-[5] overflow-visible'
                                }`}
                            >
                                <div
                                    className={`px-4 py-1 text-sm font-bold border-t border-b flex items-center justify-between transition-colors sticky top-0 z-30 ${hoveredGroup === cls.id ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : (cls.color ? 'text-slate-700 dark:text-slate-200' : titleColor)}`}
                                    style={titleCustomStyle}
                                >
                                    <div className="flex items-center text-xs">
                                        {groupTitle}
                                        {hoveredGroup === cls.id && activeDragId && (
                                            <span className="ml-2 text-[10px] text-indigo-500 animate-pulse">ここへ移動</span>
                                        )}
                                    </div>
                                    {!readOnly && cls.id !== 'unassigned' && (
                                        <AddStaffMenu
                                            classId={cls.id as ClassType}
                                            staffList={staffList}
                                            dayShifts={dayShifts}
                                            showAddMenu={showAddMenu}
                                            onToggle={(id) => setShowAddMenu(id)}
                                            onAddStaff={(staffId, classType) => { edit.handleAddStaff(staffId, classType); setShowAddMenu(null); }}
                                        />
                                    )}
                                </div>

                                <div>
                                    {groupShifts.length === 0 && (
                                        <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-[10px]">人員が割り当てられていません</div>
                                    )}
                                    {groupShifts.map((shift) => {
                                        const staff = staffList.find(s => s.id === shift.staffId);
                                        const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');
                                        const s = localShifts[shift.id] ?? { start: timeToMinutes(shift.startTime), end: timeToMinutes(shift.endTime), classType: shift.classType, isError: shift.isError ?? false } as LocalShiftData;
                                        const isDragging = activeDragId === shift.id;
                                        const allowedPatterns = roles.find(r => r.name === staff?.role)?.patterns || [];
                                        const conflictType = !s.isError ? getShiftConflictType(shift.staffId, s.start, s.end) : 'none' as const;

                                        return (
                                            <div
                                                key={shift.id}
                                                className={`flex ${readOnly ? 'flex-row items-center border-b border-slate-100 dark:border-slate-700/50' : 'flex-col sm:flex-row border-b border-slate-200 dark:border-slate-700'} ${isDragging ? 'opacity-40 bg-slate-100 dark:bg-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                                style={readOnly ? { touchAction: 'pan-y' } : {}}
                                            >
                                                {/* Left Info Column */}
                                                {!readOnly ? (
                                                    <div className="flex w-full sm:w-[480px] flex-shrink-0 text-sm bg-white dark:bg-slate-800">
                                                        <div className="w-28 sm:w-28 p-2 border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center relative group/name">
                                                            <div className="font-medium text-slate-800 dark:text-slate-200 truncate pr-1" title={staffName}>
                                                                {staffName}
                                                                {highlightStaffId === shift.staffId && (
                                                                    <span className="ml-1 text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">My</span>
                                                                )}
                                                            </div>
                                                            <ShiftRowActions
                                                                shiftId={shift.id}
                                                                showSwapMenu={showSwapMenu}
                                                                deleteConfirmId={deleteConfirmId}
                                                                onToggleSwap={setShowSwapMenu}
                                                                onToggleDelete={setDeleteConfirmId}
                                                            />
                                                            <DeleteConfirmPopup
                                                                shiftId={shift.id}
                                                                deleteConfirmId={deleteConfirmId}
                                                                onConfirm={(id) => { edit.handleRemoveShift(id); setDeleteConfirmId(null); }}
                                                                onCancel={() => setDeleteConfirmId(null)}
                                                            />
                                                            <SwapStaffMenu
                                                                shiftId={shift.id}
                                                                currentStaff={staff}
                                                                offDutyStaff={offDutyStaff}
                                                                staffMonthlyHours={staffMonthlyHours}
                                                                showSwapMenu={showSwapMenu}
                                                                onToggle={setShowSwapMenu}
                                                                onSwapStaff={(oldId, newId) => { edit.handleSwapStaff(oldId, newId); setShowSwapMenu(null); }}
                                                            />
                                                        </div>
                                                        <div className="w-36 border-r border-slate-200 dark:border-slate-700 flex items-center px-1">
                                                            <select
                                                                className="w-full text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                                                                value={allowedPatterns.find(p => p.startTime === toTimeStr(s.start) && p.endTime === toTimeStr(s.end))?.id || ''}
                                                                onChange={(e) => edit.handlePatternChange(shift.id, e.target.value)}
                                                            >
                                                                <option value="">カスタム</option>
                                                                {allowedPatterns.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.name} ({p.startTime}-{p.endTime})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="w-20 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center px-1">
                                                            <input type="time" step="900" value={toTimeStr(s.start)} onChange={e => edit.handleTimeInputChange(shift.id, 'start', e.target.value)} className="w-full text-center text-xs font-mono text-slate-700 dark:text-slate-300 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text" />
                                                        </div>
                                                        <div className="w-20 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center px-1">
                                                            <input type="time" step="900" value={toTimeStr(s.end)} onChange={e => edit.handleTimeInputChange(shift.id, 'end', e.target.value)} className="w-full text-center text-xs font-mono text-slate-700 dark:text-slate-300 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text" />
                                                        </div>
                                                        <div className="w-14 p-2 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold tabular-nums text-xs">
                                                            {calculateDuration(s.start, s.end)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className={`w-44 flex-shrink-0 px-3 py-1 border-r border-slate-100 dark:border-slate-700/50 flex items-center justify-between overflow-hidden gap-1 ${highlightStaffId === shift.staffId ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'bg-white/50 dark:bg-slate-800/50'}`}>
                                                        <div className="flex items-center gap-1 overflow-hidden">
                                                            <div className={`text-xs font-bold truncate ${highlightStaffId === shift.staffId ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`} title={staffName}>{staffName}</div>
                                                            {highlightStaffId === shift.staffId && (
                                                                <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter flex-shrink-0">My</span>
                                                            )}
                                                        </div>
                                                        <div className={`text-xs font-mono tracking-tight flex-shrink-0 ${highlightStaffId === shift.staffId ? 'text-indigo-500 dark:text-indigo-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                                                            {toTimeStr(s.start)}-{toTimeStr(s.end)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Timeline Track */}
                                                <TimelineBar
                                                    shift={shift}
                                                    localData={s}
                                                    isDragging={isDragging}
                                                    dragDeltaY={dragDeltaY}
                                                    hoveredGroup={hoveredGroup}
                                                    highlightStaffId={highlightStaffId}
                                                    readOnly={readOnly}
                                                    classColorMap={classColorMap}
                                                    timePatterns={timePatterns}
                                                    hours={hours}
                                                    conflictType={conflictType}
                                                    onPointerDown={handlePointerDown}
                                                    onPointerUp={handlePointerUp}
                                                    renderGridLines={renderGridLines}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Off-duty staff section */}
            <OffDutySection
                offDutyStaff={offDutyStaff}
                classes={classes}
                readOnly={readOnly}
                showAddMenu={showAddMenu}
                onToggleAddMenu={setShowAddMenu}
                onAddStaff={handleAddFromOffDuty}
            />
        </div>
    );
};

export default DailyTimelineView;
