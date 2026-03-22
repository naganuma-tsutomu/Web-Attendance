import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { GripVertical, Plus, Trash2, CalendarX, Lock, Unlock, RefreshCw } from 'lucide-react';
import { updateShift, saveShiftsBatch, deleteShift } from '../../lib/api';
import { isStaffAvailableReason } from '../../lib/algorithm';
import { calculateDuration as calculateDurationHours, formatHours } from '../../utils/timeUtils';
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
    // 外部から保存アクションを実行するためのリファレンス用
    saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
    readOnly?: boolean;
    isFixed?: boolean;
    onToggleFixed?: () => void;
    hideHeaderToggle?: boolean;
}

// 時間をHH:MM文字列に変換
const toTimeStr = (mins: number): string => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// HH:MM文字列を分に変換
const toMins = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// 15分単位にスナップ
const snapTo15 = (mins: number): number => Math.round(mins / 15) * 15;

const START_HOUR = 8;
const END_HOUR = 19;
const DISPLAY_START_MINS = 7 * 60 + 45; // 7:45
const DISPLAY_END_MINS = 19 * 60 + 15; // 19:15
const DISPLAY_TOTAL_MINS = DISPLAY_END_MINS - DISPLAY_START_MINS;

type DragType = 'move' | 'resize-left' | 'resize-right';

interface DragState {
    shiftId: string;
    type: DragType;
    startX: number;
    startY: number;
    origStartMins: number;
    origEndMins: number;
    origClassType: ClassType;
    origIsError: boolean;
    trackWidth: number;
}

const DailyTimelineView: React.FC<DailyTimelineViewProps> = ({
    date,
    shifts,
    staffList,
    classes,
    timePatterns,
    roles,
    preferences = [],
    onShiftUpdate,
    onModifiedChange,
    saveRef,
    readOnly = false,
    isFixed = false,
    onToggleFixed,
    hideHeaderToggle
}) => {
    const targetDateStr = format(date, 'yyyy-MM-dd');

    const [localShifts, setLocalShifts] = useState<Record<string, { start: number; end: number; classType: ClassType; isError: boolean }>>(() => {
        const init: Record<string, { start: number; end: number; classType: ClassType; isError: boolean }> = {};
        shifts.filter(s => s.date === targetDateStr).forEach(s => {
            init[s.id] = { start: toMins(s.startTime), end: toMins(s.endTime), classType: s.classType, isError: s.isError ?? false };
        });
        return init;
    });

    const [addedShifts, setAddedShifts] = useState<Shift[]>([]);
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
    const [showAddMenu, setShowAddMenu] = useState<string | null>(null);
    const [showSwapMenu, setShowSwapMenu] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [initialShifts, setInitialShifts] = useState(localShifts);

    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragDeltaY, setDragDeltaY] = useState(0);
    const [hoveredGroup, setHoveredGroup] = useState<ClassType | 'unassigned' | null>(null);

    const dragRef = useRef<DragState | null>(null);
    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // シフト時間に合わせてラベル（パターン名）を決定するヘルパー
    const getShiftLabel = useCallback((startMins: number, endMins: number) => {
        const startTime = toTimeStr(startMins);
        const endTime = toTimeStr(endMins);
        const pattern = timePatterns.find(p => p.startTime === startTime && p.endTime === endTime);
        return pattern ? pattern.name : 'カスタム';
    }, [timePatterns]);

    // dateが変わったら再初期化
    useEffect(() => {
        const init: Record<string, { start: number; end: number; classType: ClassType; isError: boolean }> = {};
        shifts.filter(s => s.date === targetDateStr).forEach(s => {
            init[s.id] = { start: toMins(s.startTime), end: toMins(s.endTime), classType: s.classType, isError: s.isError ?? false };
        });
        setLocalShifts(init);
        setInitialShifts(init);
        setAddedShifts([]);
        setDeletedIds(new Set());
    }, [targetDateStr, shifts]);

    const isModified = addedShifts.length > 0 || deletedIds.size > 0 || Object.keys(localShifts).some(id => {
        const current = localShifts[id];
        const initial = initialShifts[id];
        return initial && (
            current.start !== initial.start ||
            current.end !== initial.end ||
            current.classType !== initial.classType ||
            current.isError !== initial.isError
        );
    });

    useEffect(() => {
        onModifiedChange?.(isModified);
    }, [isModified, onModifiedChange]);

    const handleSave = useCallback(async () => {
        try {
            const hasInvalidUnassigned = Object.keys(localShifts).some(id => {
                if (deletedIds.has(id)) return false;
                const originalShift = [...shifts, ...addedShifts].find(shift => shift.id === id);
                if (!originalShift) return false;
                
                // 未設定の従業員（UNASSIGNED）が、クラスに配置されたまま（isError=false）保存されようとしているかをチェック
                return originalShift.staffId === 'UNASSIGNED' && localShifts[id].classType !== 'unassigned' && localShifts[id].isError === false;
            });

            if (hasInvalidUnassigned) {
                throw new Error('未設定の従業員がクラスに配置されています。保存する前に従業員を割り当ててください。');
            }

            if (deletedIds.size > 0) {
                await Promise.all(Array.from(deletedIds).map(id => deleteShift(id)));
            }

            if (addedShifts.length > 0) {
                const newShiftsToSave = addedShifts.map(s => {
                    const local = localShifts[s.id];
                    return {
                        date: s.date,
                        staffId: s.staffId,
                        startTime: local ? toTimeStr(local.start) : s.startTime,
                        endTime: local ? toTimeStr(local.end) : s.endTime,
                        classType: local ? local.classType : s.classType,
                        isEarlyShift: s.isEarlyShift
                    };
                });
                await saveShiftsBatch(newShiftsToSave);
            }

            const modifiedIds = Object.keys(localShifts).filter(id => {
                if (id.startsWith('temp-')) return false;
                const current = localShifts[id];
                const initial = initialShifts[id];
                return initial && (
                    current.start !== initial.start ||
                    current.end !== initial.end ||
                    current.classType !== initial.classType ||
                    current.isError !== initial.isError
                );
            });

            if (modifiedIds.length > 0) {
                await Promise.all(modifiedIds.map(id => {
                    const s = localShifts[id];
                    return updateShift(id, {
                        startTime: toTimeStr(s.start),
                        endTime: toTimeStr(s.end),
                        classType: s.classType,
                        isError: s.isError,
                    });
                }));
            }

            onShiftUpdate?.();
        } catch (error) {
            console.error('Save failed:', error);
            throw error;
        }
    }, [addedShifts, deletedIds, localShifts, initialShifts, onShiftUpdate]);

    useEffect(() => {
        if (saveRef) {
            saveRef.current = handleSave;
        }
    }, [saveRef, handleSave]);

    const hourLabels = Array.from({ length: (END_HOUR - START_HOUR) + 1 }, (_, i) => START_HOUR + i);

    const dayShifts = useMemo<Shift[]>(() => {
        return [...shifts.filter(s => s.date === targetDateStr), ...addedShifts]
            .filter(s => !deletedIds.has(s.id))
            .sort((a, b) => {
                if (a.classType !== b.classType) return a.classType.localeCompare(b.classType);
                const indexA = staffList.findIndex(s => s.id === a.staffId);
                const indexB = staffList.findIndex(s => s.id === b.staffId);
                if (indexA !== -1 && indexB !== -1) {
                    if (indexA !== indexB) return indexA - indexB;
                } else if (indexA !== -1) {
                    return -1;
                } else if (indexB !== -1) {
                    return 1;
                }
                return a.startTime.localeCompare(b.startTime);
            });
    }, [shifts, targetDateStr, addedShifts, deletedIds, staffList]);

    const targetYearMonth = format(date, 'yyyy-MM');

    const staffMonthlyHours = useMemo(() => {
        const hours: Record<string, number> = {};
        
        // 既存のシフトから削除予定のものを除外
        const baseMonthShifts = shifts.filter(s => 
            s.date.startsWith(targetYearMonth) && 
            !deletedIds.has(s.id) && 
            s.staffId !== 'UNASSIGNED'
        );
        
        // ローカルで追加されたシフトを含める
        const addedMonthShifts = addedShifts.filter(s => 
            s.date.startsWith(targetYearMonth) && 
            s.staffId !== 'UNASSIGNED'
        );

        [...baseMonthShifts, ...addedMonthShifts].forEach(s => {
            const duration = calculateDurationHours(s.startTime, s.endTime);
            hours[s.staffId] = (hours[s.staffId] || 0) + duration;
        });
        return hours;
    }, [shifts, addedShifts, deletedIds, targetYearMonth]);

    const offDutyStaff = useMemo(() => {
        // 希望休があるスタッフはシフトに入っていても表示するため、全スタッフを対象にして
        // 「シフトなし」または「希望休がある」スタッフをリストアップする
        return staffList
            .map(staff => {
                const isOnShift = dayShifts.some(s => s.staffId === staff.id);
                const reason = isStaffAvailableReason(staff, date, targetDateStr, preferences);
                
                let isFullDayPref = false;
                let isPartialPref = false;
                let timeStr = null;

                const pref = preferences.find(p => p.staffId === staff.id);
                if (pref) {
                    if (pref.details && pref.details.length > 0) {
                        const detail = pref.details.find(d => d.date === targetDateStr);
                        if (detail) {
                            if (!detail.startTime && !detail.endTime) {
                                isFullDayPref = true;
                            } else if (detail.startTime && detail.endTime) {
                                isPartialPref = true;
                                timeStr = `${detail.startTime}-${detail.endTime}`;
                            }
                        }
                    } else if (pref.unavailableDates.includes(targetDateStr)) {
                        isFullDayPref = true;
                    }
                }

                // 希望休があるか、シフトに入っていないスタッフのみ表示
                const hasPreference = isFullDayPref || isPartialPref || reason === 'preference';
                if (!isOnShift || hasPreference) {
                    return { staff, reason, isFullDayPref, isPartialPref, timeStr, isOnShift };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [staffList, dayShifts, date, targetDateStr, preferences]);

    const getBarStyle = (shift: Shift) => {
        const s = localShifts[shift.id] || {
            start: toMins(shift.startTime),
            end: toMins(shift.endTime),
            classType: shift.classType
        };
        const clampedStart = Math.max(START_HOUR * 60, s.start);
        const clampedEnd = Math.min(END_HOUR * 60, s.end);
        const left = ((clampedStart - DISPLAY_START_MINS) / DISPLAY_TOTAL_MINS) * 100;
        const width = ((clampedEnd - clampedStart) / DISPLAY_TOTAL_MINS) * 100;
        return {
            left: `${left}%`,
            width: `${Math.max(0.5, width)}%`,
        };
    };

    const getBarColor = (classType: ClassType | 'unassigned', isError?: boolean, isPreferenceConflict?: boolean) => {
        if (isError || classType === 'unassigned') return 'bg-slate-300 border-slate-400 dark:bg-slate-600 dark:border-slate-500';
        // 希望休と衝突している場合はオレンジ
        if (isPreferenceConflict) return 'bg-orange-300 border-orange-400 dark:bg-orange-500/60 dark:border-orange-500';

        // IDまたは名称で判定
        if (classType === '虹組' || classType === 'class_niji') return 'bg-yellow-300 border-yellow-400';
        if (classType === 'スマイル組' || classType === 'class_smile') return 'bg-blue-300 border-blue-400';
        if (classType === '特殊' || classType === 'class_special') return 'bg-emerald-300 border-emerald-400';

        return 'bg-purple-300 border-purple-400';
    };

    // スタッフの希望休とシフト時間が衝突しているか判定するヘルパー
    const isShiftConflictingWithPreference = (staffId: string, shiftStartMins: number, shiftEndMins: number): boolean => {
        const pref = preferences.find(p => p.staffId === staffId);
        if (!pref) return false;

        if (pref.details && pref.details.length > 0) {
            const detail = pref.details.find(d => d.date === targetDateStr);
            if (!detail) return false;
            // 終日希望休
            if (!detail.startTime && !detail.endTime) return true;
            // 時間帯希望休：シフトとの重複チェック
            if (detail.startTime && detail.endTime) {
                const prefStart = toMins(detail.startTime);
                const prefEnd = toMins(detail.endTime);
                return shiftStartMins < prefEnd && shiftEndMins > prefStart;
            }
        } else if (pref.unavailableDates.includes(targetDateStr)) {
            // 終日希望休
            return true;
        }
        return false;
    };

    const calculateDuration = (startMins: number, endMins: number) => {
        const diff = endMins - startMins;
        if (diff < 0) return '??';
        return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
    };

    const handlePointerDown = useCallback((
        e: React.PointerEvent,
        shiftId: string,
        type: DragType,
        trackEl: HTMLElement
    ) => {
        // e.preventDefault(); // PointerDown で preventDefault するとフォーカスが当たらなくなる場合があるため注意
        if (readOnly) return;
        const rect = trackEl.getBoundingClientRect();
        const s = localShifts[shiftId];
        dragRef.current = {
            shiftId,
            type,
            startX: e.clientX,
            startY: e.clientY,
            origStartMins: s.start,
            origEndMins: s.end,
            origClassType: s.classType,
            origIsError: s.isError,
            trackWidth: rect.width,
        };
        setActiveDragId(shiftId);
        setDragDeltaY(0);
        setHoveredGroup(s.isError ? 'unassigned' : s.classType);

        // ポインターキャプチャを設定して、要素外に出てもイベントを追跡できるようにする
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [localShifts, readOnly]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;

        const dx = e.clientX - drag.startX;
        const minsPerPx = DISPLAY_TOTAL_MINS / drag.trackWidth;
        const deltaMins = snapTo15(dx * minsPerPx);

        let newClassType: ClassType | 'unassigned' = drag.origIsError ? 'unassigned' : drag.origClassType;
        if (drag.type === 'move') {
            const dy = e.clientY - drag.startY;
            setDragDeltaY(dy);
            const classNames = classes.map(c => c.id);
            const groups: (string | 'unassigned')[] = [...classNames, 'unassigned'];
            for (const cls of groups) {
                const el = groupRefs.current[cls];
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        newClassType = cls as ClassType | 'unassigned';
                        break;
                    }
                }
            }
            setHoveredGroup(newClassType);
        }

        setLocalShifts(prev => {
            const orig = { start: drag.origStartMins, end: drag.origEndMins };
            let newStart = orig.start;
            let newEnd = orig.end;
            const MIN_DURATION = 15;

            // クラス間移動（垂直ドラッグ）が発生している場合、時間は固定する
            const isChangingClass = drag.type === 'move' && newClassType !== (drag.origIsError ? 'unassigned' : drag.origClassType);

            if (!isChangingClass) {
                if (drag.type === 'move') {
                    newStart = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - (orig.end - orig.start), orig.start + deltaMins));
                    newEnd = newStart + (orig.end - orig.start);
                } else if (drag.type === 'resize-left') {
                    newStart = Math.max(START_HOUR * 60, Math.min(orig.end - MIN_DURATION, orig.start + deltaMins));
                } else if (drag.type === 'resize-right') {
                    newEnd = Math.min(END_HOUR * 60, Math.max(orig.start + MIN_DURATION, orig.end + deltaMins));
                }
            } else {
                // クラスが変更されている間は、開始時の時間を維持する
                newStart = orig.start;
                newEnd = orig.end;
            }

            return { ...prev, [drag.shiftId]: { ...prev[drag.shiftId], start: newStart, end: newEnd } };
        });
    }, [classes]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;

        (e.target as HTMLElement).releasePointerCapture(e.pointerId);

        dragRef.current = null;
        const finalClassType = hoveredGroup;
        setActiveDragId(null);
        setDragDeltaY(0);
        setHoveredGroup(null);

        const s = localShifts[drag.shiftId];
        if (!s) return;
        setLocalShifts(prev => ({
            ...prev,
            [drag.shiftId]: {
                ...prev[drag.shiftId],
                classType: (finalClassType && finalClassType !== 'unassigned') ? finalClassType : drag.origClassType,
                isError: finalClassType === 'unassigned'
            }
        }));
    }, [localShifts, hoveredGroup]);

    const handlePatternChange = (shiftId: string, patternId: string) => {
        const pattern = timePatterns.find(p => p.id === patternId);
        if (!pattern) return;

        setLocalShifts(prev => ({
            ...prev,
            [shiftId]: {
                ...prev[shiftId],
                start: toMins(pattern.startTime),
                end: toMins(pattern.endTime)
            }
        }));
    };

    const handleTimeInputChange = (shiftId: string, field: 'start' | 'end', value: string) => {
        const mins = toMins(value);
        const snapped = snapTo15(mins);
        setLocalShifts(prev => {
            const curr = prev[shiftId];
            const MIN_DURATION = 15;
            if (field === 'start') {
                const newStart = Math.max(START_HOUR * 60, Math.min(curr.end - MIN_DURATION, snapped));
                return { ...prev, [shiftId]: { ...curr, start: newStart } };
            } else {
                const newEnd = Math.min(END_HOUR * 60, Math.max(curr.start + MIN_DURATION, snapped));
                return { ...prev, [shiftId]: { ...curr, end: newEnd } };
            }
        });
    };

    const handleAddStaff = (staffId: string, classType: ClassType) => {
        const staff = staffList.find(s => s.id === staffId);
        if (!staff) return;
        const startTime = staff.defaultWorkingHoursStart || "10:00";
        const endTime = staff.defaultWorkingHoursEnd || "15:00";
        const tempId = `temp-${crypto.randomUUID()}-${staffId}`;
        const newShift: Shift = {
            id: tempId,
            date: targetDateStr,
            staffId: staffId,
            startTime: startTime,
            endTime: endTime,
            classType: classType,
            isEarlyShift: false,
            isError: false,
        };
        setAddedShifts(prev => [...prev, newShift]);
        setLocalShifts(prev => ({
            ...prev,
            [tempId]: {
                start: toMins(startTime),
                end: toMins(endTime),
                classType: classType,
                isError: false
            }
        }));
        setShowAddMenu(null);
    };

    const handleRemoveShift = (shiftId: string) => {
        if (shiftId.startsWith('temp-')) {
            setAddedShifts(prev => prev.filter(s => s.id !== shiftId));
            setLocalShifts(prev => {
                const next = { ...prev };
                delete next[shiftId];
                return next;
            });
        } else {
            setDeletedIds(prev => {
                const next = new Set(prev);
                next.add(shiftId);
                return next;
            });
        }
    };

    const handleSwapStaff = (oldShiftId: string, newStaffId: string) => {
        const oldShift = [...shifts.filter(s => s.date === targetDateStr), ...addedShifts].find(s => s.id === oldShiftId);
        if (!oldShift) return;

        const oldLocal = localShifts[oldShiftId] || {
            start: toMins(oldShift.startTime),
            end: toMins(oldShift.endTime),
            classType: oldShift.classType,
            isError: oldShift.isError || false
        };

        const tempId = `temp-${crypto.randomUUID()}-${newStaffId}`;
        const newShift: Shift = {
            ...oldShift,
            id: tempId,
            staffId: newStaffId,
            isError: false
        };

        if (oldShiftId.startsWith('temp-')) {
            setAddedShifts(prev => prev.filter(s => s.id !== oldShiftId));
        } else {
            setDeletedIds(prev => {
                const next = new Set(prev);
                next.add(oldShiftId);
                return next;
            });
        }

        setAddedShifts(prev => [...prev, newShift]);
        
        setLocalShifts(prev => {
            const next = { ...prev };
            next[tempId] = { ...oldLocal, isError: false };
            if (oldShiftId.startsWith('temp-')) {
                delete next[oldShiftId];
            }
            return next;
        });

        setShowSwapMenu(null);
    };

    const renderGridLines = () => {
        const lines = [];
        const totalSlots = (END_HOUR - START_HOUR) * 4;
        for (let i = 0; i <= totalSlots; i++) {
            const currentMins = START_HOUR * 60 + i * 15;
            const isHour = i % 4 === 0;
            const isHalf = i % 2 === 0 && !isHour;
            const leftOffset = ((currentMins - DISPLAY_START_MINS) / DISPLAY_TOTAL_MINS) * 100;
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
    };

    return (
        <div
            className={`select-none touch-none flex-shrink-0 flex flex-col ${readOnly ? '' : 'flex-1 overflow-auto min-h-0'}`}
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
                        {isFixed ? '自動生成からロック中' : 'シフトをロックする'}
                    </button>
                </div>
            )}
            <div className="min-w-full md:min-w-[800px] overflow-visible flex flex-col bg-white dark:bg-slate-800">
                {/* Header Row - Hide in readOnly mode to save space and avoid layout issues */}
                {!readOnly && (
                    <div className={`flex bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 sticky top-0 z-20`}>
                        <div className="hidden sm:flex w-[480px] flex-shrink-0">
                            <div className="w-28 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">名前</div>
                            <div className="w-36 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">シフトパターン</div>
                            <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">開始</div>
                            <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">終了</div>
                            <div className="w-14 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">時間</div>
                        </div>
                        {/* Mobile Header Column for info */}
                        <div className="sm:hidden w-24 flex-shrink-0 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">
                            スタッフ
                        </div>
                        <div className="flex-1 relative h-8 border-l border-slate-300 dark:border-slate-600">
                            {hourLabels.map((h) => {
                                const leftPct = ((h * 60 - DISPLAY_START_MINS) / DISPLAY_TOTAL_MINS) * 100;
                                return (
                                    <React.Fragment key={h}>
                                        <div
                                            className="absolute top-0 bottom-0 border-l border-slate-300/50 dark:border-slate-600/50"
                                            style={{ left: `${leftPct}%` }}
                                        />
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-0.5 z-10"
                                            style={{ left: `${leftPct}%` }}
                                        >
                                            {h}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Simplified Header for readOnly mode */}
                {readOnly && (
                    <div className="flex bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 sticky top-0 z-20">
                        <div className="w-20 flex-shrink-0 p-1.5 border-r border-slate-200 dark:border-slate-700 text-center">名前</div>
                        <div className="flex-1 relative h-6">
                            {hourLabels.map((h) => {
                                const leftPct = ((h * 60 - DISPLAY_START_MINS) / DISPLAY_TOTAL_MINS) * 100;
                                return (
                                    <div
                                        key={h}
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[9px] text-slate-400"
                                        style={{ left: `${leftPct}%` }}
                                    >
                                        {h}
                                    </div>
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

                            if (cls.id === 'unassigned') {
                                return (isError || !classes.some(c => c.id === currentClassId));
                            }
                            return currentClassId === cls.id && !isError;
                        });

                        if (groupShifts.length === 0 && cls.id === 'unassigned') return null;

                        const groupTitle = cls.name === '特殊' ? 'ヘルプ' : cls.name;

                        // 常にクラス ID に基づいて色を決定するように変更（またはクラス名）
                        const getDynamicColor = (classId: string, className: string) => {
                            const colorMap: Record<string, string> = {
                                'class_smile': 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800',
                                'class_niji': 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-100 dark:border-yellow-800',
                                'class_special': 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800',
                                'unassigned': 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700'
                            };
                            // 名前でのマッチングもフォールバックとして残しておく
                            if (colorMap[classId]) return colorMap[classId];
                            if (className === 'スマイル組') return colorMap['class_smile'];
                            if (className === '虹組') return colorMap['class_niji'];
                            if (className === '特殊' || className === 'ヘルプ') return colorMap['class_special'];
                            if (classId === 'unassigned') return colorMap['unassigned'];

                            return 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800';
                        };

                        const titleColor = getDynamicColor(cls.id, cls.name);

                        return (
                            <div
                                key={cls.id}
                                ref={el => { groupRefs.current[cls.id] = el; }}
                                className={`mb-2 last:mb-0 border border-slate-200 dark:border-slate-700 shadow-sm relative ${
                                    dayShifts.some(s => (showSwapMenu === s.id || deleteConfirmId === s.id) && (localShifts[s.id]?.classType === cls.id || (s.classType === cls.id && !localShifts[s.id]))) || showAddMenu === cls.id
                                    ? 'z-50 overflow-visible' 
                                    : 'z-[5] overflow-visible'
                                }`}
                            >
                                <div className={`px-4 py-1 text-sm font-bold border-t border-b flex items-center justify-between transition-colors sticky top-0 z-30 ${hoveredGroup === cls.id ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : titleColor}`}>
                                    <div className="flex items-center text-xs">
                                        {groupTitle}
                                        {hoveredGroup === cls.id && activeDragId && (
                                            <span className="ml-2 text-[10px] text-indigo-500 animate-pulse">ここへ移動</span>
                                        )}
                                    </div>

                                    {!readOnly && cls.id !== 'unassigned' && (
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowAddMenu(prev => prev === cls.id ? null : (cls.id as ClassType))}
                                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded border border-current transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                追加
                                            </button>

                                            {showAddMenu === cls.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowAddMenu(null); }} />
                                                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
                                                    {staffList
                                                        .filter(st => !dayShifts.some(s => s.staffId === st.id))
                                                        .length === 0 ? (
                                                        <div className="px-3 py-2 text-[11px] text-slate-400 text-center">追加可能な従業員はいません</div>
                                                    ) : (
                                                        staffList
                                                            .filter(st => !dayShifts.some(s => s.staffId === st.id))
                                                            .map(st => (
                                                                <button
                                                                    key={st.id}
                                                                    onClick={() => handleAddStaff(st.id, cls.id as ClassType)}
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
                                    )}
                                </div>
                                <div>
                                    {groupShifts.length === 0 && (
                                        <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-[10px]">
                                            人員が割り当てられていません
                                        </div>
                                    )}
                                    {groupShifts.map((shift) => {
                                        const staff = staffList.find(s => s.id === shift.staffId);
                                        const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');
                                        const s = localShifts[shift.id] ?? { start: toMins(shift.startTime), end: toMins(shift.endTime), classType: shift.classType };
                                        const isDragging = activeDragId === shift.id;
                                        const allowedPatterns = roles.find(r => r.name === staff?.role)?.patterns || [];

                                        return (
                                            <div
                                                key={shift.id}
                                                className={`flex ${readOnly ? 'flex-row items-center border-b border-slate-100 dark:border-slate-700/50' : 'flex-col sm:flex-row border-b border-slate-200 dark:border-slate-700'} ${isDragging ? 'opacity-40 bg-slate-100 dark:bg-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                            >
                                                {/* Left Info Column */}
                                                {!readOnly ? (
                                                    <div className="flex w-full sm:w-[480px] flex-shrink-0 text-sm bg-white dark:bg-slate-800">
                                                        <div className="w-28 sm:w-28 p-2 border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center relative group/name">
                                                            <div className="font-medium text-slate-800 dark:text-slate-200 truncate pr-1" title={staffName}>{staffName}</div>
                                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-20 group-hover/name:opacity-100 transition-all bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm px-0.5 py-0.5 rounded shadow border border-slate-200 dark:border-slate-700/80">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setShowSwapMenu(prev => prev === shift.id ? null : shift.id); setDeleteConfirmId(null); }}
                                                                    className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                                                    title="入れ替え"
                                                                >
                                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                                </button>
                                                                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700"></div>
                                                                <button 
                                                                    onClick={(e) => { 
                                                                        e.stopPropagation(); 
                                                                        setDeleteConfirmId(prev => prev === shift.id ? null : shift.id);
                                                                        setShowSwapMenu(null);
                                                                    }} 
                                                                    className={`p-1 rounded transition-colors ${deleteConfirmId === shift.id ? 'text-red-500 bg-red-50 dark:bg-red-900/30' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                                                                    title="削除"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            
                                                            {deleteConfirmId === shift.id && (
                                                                <>
                                                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} />
                                                                    <div className="absolute left-full top-0 ml-1 z-[60] w-56 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 rounded-lg shadow-2xl py-3 px-3 animate-in fade-in zoom-in-95 duration-200">
                                                                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-3">
                                                                            このシフトを削除しますか？
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleRemoveShift(shift.id); setDeleteConfirmId(null); }} 
                                                                                className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-[11px] rounded transition-colors font-bold shadow-sm whitespace-nowrap"
                                                                            >
                                                                                削除
                                                                            </button>
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} 
                                                                                className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-[11px] rounded transition-colors font-medium border border-slate-200 dark:border-slate-600 text-center whitespace-nowrap"
                                                                            >
                                                                                キャンセル
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                            
                                                            {showSwapMenu === shift.id && (() => {
                                                                const currentStaff = staffList.find(s => s.id === shift.staffId);
                                                                const availableStaff = currentStaff
                                                                    ? offDutyStaff.filter(({ staff }) => staff.role === currentStaff.role)
                                                                    : offDutyStaff;
                                                                
                                                                return (
                                                                    <>
                                                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowSwapMenu(null); }} />
                                                                        <div className="absolute left-full top-0 ml-1 z-[60] w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl py-1 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                                                            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-700 mb-1 sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 flex justify-between">
                                                                                <span>入れ替え候補 {currentStaff ? `(${currentStaff.role})` : '(全職種)'}</span>
                                                                                <span className="text-[8px] font-normal lowercase">月間労働時間</span>
                                                                            </div>
                                                                            {availableStaff.length === 0 ? (
                                                                                <div className="px-3 py-4 text-[11px] text-slate-400 text-center italic">
                                                                                    {currentStaff ? '同じ役職の待機スタッフはいません' : '待機スタッフはいません'}
                                                                                </div>
                                                                            ) : (
                                                                                availableStaff.map(({ staff, reason, isFullDayPref, isPartialPref, timeStr }) => {
                                                                                    const monthlyHours = formatHours(staffMonthlyHours[staff.id] || 0);
                                                                                    const target = staff.hoursTarget || 0;
                                                                                    const isOver = target > 0 && Number(monthlyHours) > target;
                                                                                    
                                                                                    return (
                                                                                        <button
                                                                                            key={staff.id}
                                                                                            onClick={(e) => { e.stopPropagation(); handleSwapStaff(shift.id, staff.id); }}
                                                                                            className="w-full text-left px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-between group/candidate"
                                                                                        >
                                                                                            <div className="flex flex-col">
                                                                                                <span className="font-medium group-hover/candidate:text-indigo-600 dark:group-hover/candidate:text-indigo-400">{staff.name}</span>
                                                                                                {(reason === 'preference' || isFullDayPref) && (
                                                                                                    <span className="text-[8px] text-red-500 font-bold mt-0.5 flex items-center gap-0.5">
                                                                                                        <CalendarX className="w-2 h-2" /> 希望休(終日)
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
                                                            })()}
                                                        </div>
                                                        <div className="w-36 border-r border-slate-200 dark:border-slate-700 flex items-center px-1">
                                                            <select
                                                                className="w-full text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                                                                value={allowedPatterns.find(p => p.startTime === toTimeStr(s.start) && p.endTime === toTimeStr(s.end))?.id || ''}
                                                                onChange={(e) => handlePatternChange(shift.id, e.target.value)}
                                                            >
                                                                <option value="">カスタム</option>
                                                                {allowedPatterns.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.name} ({p.startTime}-{p.endTime})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="w-20 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center px-1">
                                                            <input type="time" step="900" value={toTimeStr(s.start)} onChange={e => handleTimeInputChange(shift.id, 'start', e.target.value)} className="w-full text-center text-xs font-mono text-slate-700 dark:text-slate-300 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text" />
                                                        </div>
                                                        <div className="w-20 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center px-1">
                                                            <input type="time" step="900" value={toTimeStr(s.end)} onChange={e => handleTimeInputChange(shift.id, 'end', e.target.value)} className="w-full text-center text-xs font-mono text-slate-700 dark:text-slate-300 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text" />
                                                        </div>
                                                        <div className="w-14 p-2 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold tabular-nums text-xs">
                                                            {calculateDuration(s.start, s.end)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-20 flex-shrink-0 px-2 py-1 border-r border-slate-100 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 flex flex-col justify-center overflow-hidden">
                                                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate" title={staffName}>{staffName}</div>
                                                        <div className="text-[8px] text-slate-400 font-mono tracking-tighter">
                                                            {toTimeStr(s.start)}-{toTimeStr(s.end)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Timeline Track */}
                                                <div className={`flex-1 relative ${readOnly ? 'py-1 min-h-[36px]' : 'py-2 min-h-[52px]'} w-full bg-white dark:bg-slate-800`} id={`track-${shift.id}`}>
                                                    {renderGridLines()}
                                                    {(() => {
                                                        const currentClassType = isDragging && hoveredGroup ? hoveredGroup : (readOnly ? shift.classType : s.classType);
                                                        const currentIsError = readOnly ? shift.isError : s.isError;
                                                        const prefConflict = !currentIsError && isShiftConflictingWithPreference(shift.staffId, s.start, s.end);
                                                        return (
                                                    <div
                                                        className={`absolute ${readOnly ? 'top-1 bottom-1' : 'top-2 bottom-2'} rounded border shadow flex items-center ${getBarColor(currentClassType, currentIsError, prefConflict)} ${isDragging ? 'z-50 shadow-2xl scale-105 opacity-100 ring-2 ring-indigo-500 cursor-grabbing' : 'z-10 cursor-grab active:cursor-grabbing hover:scale-[1.02]'} transition-all duration-75`}
                                                        style={{ ...getBarStyle(shift), transform: isDragging ? `translateY(${dragDeltaY}px)` : 'none' }}
                                                        onPointerDown={e => {
                                                            if (readOnly) return;
                                                            const trackEl = document.getElementById(`track-${shift.id}`);
                                                            if (trackEl) handlePointerDown(e, shift.id, 'move', trackEl);
                                                        }}
                                                        onPointerUp={handlePointerUp}
                                                        onPointerCancel={handlePointerUp}
                                                    >
                                                        {!readOnly && (
                                                            <div className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-20 rounded-l transition-opacity hover:bg-black/5" onPointerDown={e => { e.stopPropagation(); if (readOnly) return; const trackEl = document.getElementById(`track-${shift.id}`); if (trackEl) handlePointerDown(e, shift.id, 'resize-left', trackEl); }}><div className="w-1 h-5 bg-slate-600/30 rounded-full" /></div>
                                                        )}
                                                        <div className="flex-1 px-1 sm:px-2 text-[9px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-800 truncate text-center select-none pointer-events-none uppercase tracking-tighter">
                                                            {!readOnly && <GripVertical className="inline w-3 h-3 mr-1 opacity-40" />}
                                                            {getShiftLabel(readOnly ? toMins(shift.startTime) : s.start, readOnly ? toMins(shift.endTime) : s.end)}
                                                        </div>
                                                        {!readOnly && (
                                                            <div className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-20 rounded-r transition-opacity hover:bg-black/5" onPointerDown={e => { e.stopPropagation(); if (readOnly) return; const trackEl = document.getElementById(`track-${shift.id}`); if (trackEl) handlePointerDown(e, shift.id, 'resize-right', trackEl); }}><div className="w-1 h-5 bg-slate-600/30 rounded-full" /></div>
                                                        )}
                                                    </div>
                                                        );
                                                    })()}
                                                </div>
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
            <div className="mt-6">
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
                        offDutyStaff.map(({ staff, reason, isFullDayPref, isPartialPref, timeStr, isOnShift }) => (
                            <div key={staff.id} className="relative">
                                <button
                                    onClick={() => !readOnly && !isOnShift && setShowAddMenu(prev => prev === staff.id ? null : staff.id)}
                                    disabled={readOnly || isOnShift}
                                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[11px] font-medium ${
                                        isOnShift
                                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 opacity-90 cursor-default'
                                            : reason === 'preference' || isPartialPref
                                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                    } ${!isOnShift && !readOnly ? (reason === 'preference' || isPartialPref) ? 'hover:bg-red-100 dark:hover:bg-red-900/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}`}
                                >
                                    {(reason === 'preference' || isPartialPref) && <CalendarX className="w-3 h-3 opacity-70" />}
                                    <span>{staff.name}</span>
                                    {(reason === 'preference' || isFullDayPref) && (
                                        <span className="text-[9px] bg-red-100 dark:bg-red-900/50 px-1 rounded">希望休(終日)</span>
                                    )}
                                    {isPartialPref && timeStr && (
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
                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowAddMenu(null); }} />
                                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700 mb-1">
                                            追加先のクラスを選択
                                        </div>
                                        {classes.map(cls => (
                                            <button
                                                key={cls.id}
                                                onClick={() => handleAddStaff(staff.id, cls.id)}
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
        </div>
    );
};

export default DailyTimelineView;
