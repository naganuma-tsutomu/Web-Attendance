import React, { useState, useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { updateShift, saveShiftsBatch, deleteShift } from '../../lib/api';
import type { Shift, Staff, ClassType, ShiftClass, ShiftTimePattern } from '../../types';

interface DailyTimelineViewProps {
    date: Date;
    shifts: Shift[];
    staffList: Staff[];
    classes: ShiftClass[];
    timePatterns: ShiftTimePattern[];
    onShiftUpdate?: () => void;
    onModifiedChange?: (modified: boolean) => void;
    // 外部から保存アクションを実行するためのリファレンス用
    saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
    readOnly?: boolean;
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
    onShiftUpdate,
    onModifiedChange,
    saveRef,
    readOnly = false
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
    const [showAddMenu, setShowAddMenu] = useState<ClassType | null>(null);
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

    if (saveRef) {
        saveRef.current = handleSave;
    }

    const hourLabels = Array.from({ length: (END_HOUR - START_HOUR) + 1 }, (_, i) => START_HOUR + i);

    const dayShifts = [...shifts.filter(s => s.date === targetDateStr), ...addedShifts]
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

    const getBarStyle = (shiftId: string) => {
        const s = localShifts[shiftId];
        if (!s) return {};
        const clampedStart = Math.max(START_HOUR * 60, s.start);
        const clampedEnd = Math.min(END_HOUR * 60, s.end);
        const left = ((clampedStart - DISPLAY_START_MINS) / DISPLAY_TOTAL_MINS) * 100;
        const width = ((clampedEnd - clampedStart) / DISPLAY_TOTAL_MINS) * 100;
        return {
            left: `${left}%`,
            width: `${Math.max(0.5, width)}%`,
        };
    };

    const getBarColor = (classType: ClassType | 'unassigned', isError?: boolean) => {
        if (isError || classType === 'unassigned') return 'bg-red-400 border-red-500';

        // IDまたは名称で判定
        if (classType === '虹組' || classType === 'class_niji') return 'bg-yellow-300 border-yellow-400';
        if (classType === 'スマイル組' || classType === 'class_smile') return 'bg-blue-300 border-blue-400';
        if (classType === '特殊' || classType === 'class_special') return 'bg-emerald-300 border-emerald-400';

        return 'bg-purple-300 border-purple-400';
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
    }, [hoveredGroup, classes]);

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
        const tempId = `temp-${Date.now()}-${staffId}`;
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
            className="flex-1 overflow-auto min-h-0 select-none touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div className="min-w-full md:min-w-[800px] border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden flex flex-col bg-white dark:bg-slate-800">
                {/* Header Row */}
                <div className="flex bg-slate-100 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 sticky top-0 z-20">
                    <div className="hidden sm:flex w-[330px] flex-shrink-0">
                        <div className="w-28 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">名前</div>
                        <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">開始</div>
                        <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">終了</div>
                        <div className="w-14 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">時間</div>
                    </div>
                    {/* Mobile Header Column for info */}
                    <div className="sm:hidden w-24 flex-shrink-0 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">
                        スタッフ
                    </div>
                    <div className="flex-1 relative h-8">
                        {hourLabels.map((h) => {
                            const leftPct = ((h * 60 - DISPLAY_START_MINS) / DISPLAY_TOTAL_MINS) * 100;
                            return (
                                <div
                                    key={h}
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-0.5"
                                    style={{ left: `${leftPct}%` }}
                                >
                                    {h}
                                </div>
                            );
                        })}
                    </div>
                </div>

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
                                'unassigned': 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800'
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
                                className={`mb-4 last:mb-0 border-x border-b border-slate-200 dark:border-slate-700 shadow-sm rounded-b-lg`}
                            >
                                <div className={`px-4 py-2 text-sm font-bold border-t border-b flex items-center justify-between ${hoveredGroup === cls.id ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : titleColor}`}>
                                    <div className="flex items-center">
                                        {groupTitle}
                                        {hoveredGroup === cls.id && activeDragId && (
                                            <span className="ml-2 text-[10px] text-indigo-500 animate-pulse">ここへ移動</span>
                                        )}
                                    </div>

                                    {cls.id !== 'unassigned' && (
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowAddMenu(prev => prev === cls.id ? null : (cls.id as ClassType))}
                                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 rounded border border-current transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                追加
                                            </button>

                                            {showAddMenu === cls.id && (
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
                                    {groupShifts.map((shift, idx) => {
                                        const staff = staffList.find(s => s.id === shift.staffId);
                                        const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');
                                        const s = localShifts[shift.id] ?? { start: toMins(shift.startTime), end: toMins(shift.endTime), classType: shift.classType };
                                        const isLast = idx === groupShifts.length - 1;
                                        const isDragging = activeDragId === shift.id;

                                        return (
                                            <div
                                                key={shift.id}
                                                className={`flex flex-col sm:flex-row ${!isLast ? 'border-b border-slate-200 dark:border-slate-700' : ''} ${isDragging ? 'opacity-40 bg-slate-100 dark:bg-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                            >
                                                <div className="flex w-full sm:w-[330px] flex-shrink-0 text-sm bg-white dark:bg-slate-800">
                                                    <div className="w-28 sm:w-28 p-2 border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center overflow-hidden relative group/name">
                                                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate" title={staffName}>{staffName}</div>
                                                        <button onClick={() => handleRemoveShift(shift.id)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/name:opacity-100 transition-all hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
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
                                                <div className="flex-1 relative py-2 min-h-[52px] w-full" id={`track-${shift.id}`}>
                                                    {renderGridLines()}
                                                    <div
                                                        className={`absolute top-2 bottom-2 rounded border shadow flex items-center ${getBarColor(isDragging && hoveredGroup ? hoveredGroup : s.classType, s.isError)} ${isDragging ? 'z-50 shadow-2xl scale-105 opacity-100 ring-2 ring-indigo-500 cursor-grabbing' : 'z-10 cursor-grab active:cursor-grabbing hover:scale-[1.02]'} transition-all duration-75`}
                                                        style={{ ...getBarStyle(shift.id), transform: isDragging ? `translateY(${dragDeltaY}px)` : 'none' }}
                                                        onPointerDown={e => {
                                                            if (readOnly) return;
                                                            const trackEl = document.getElementById(`track-${shift.id}`);
                                                            if (trackEl) handlePointerDown(e, shift.id, 'move', trackEl);
                                                        }}
                                                        onPointerUp={handlePointerUp}
                                                        onPointerCancel={handlePointerUp}
                                                    >
                                                        <div className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-20 rounded-l transition-opacity hover:bg-black/5" onPointerDown={e => { e.stopPropagation(); if (readOnly) return; const trackEl = document.getElementById(`track-${shift.id}`); if (trackEl) handlePointerDown(e, shift.id, 'resize-left', trackEl); }}><div className="w-1 h-5 bg-slate-600/30 rounded-full" /></div>
                                                        <div className="flex-1 px-3 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-800 truncate text-center select-none pointer-events-none uppercase tracking-tighter">
                                                            <GripVertical className="inline w-3 h-3 mr-1 opacity-40" />
                                                            {getShiftLabel(s.start, s.end)}
                                                        </div>
                                                        <div className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-20 rounded-r transition-opacity hover:bg-black/5" onPointerDown={e => { e.stopPropagation(); if (readOnly) return; const trackEl = document.getElementById(`track-${shift.id}`); if (trackEl) handlePointerDown(e, shift.id, 'resize-right', trackEl); }}><div className="w-1 h-5 bg-slate-600/30 rounded-full" /></div>
                                                    </div>
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

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center gap-4 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                {classes.map(c => (
                    <div key={c.id} className="flex items-center space-x-1.5">
                        <div className={`w-3 h-3 rounded-sm border ${getBarColor(c.id).replace('bg-', 'bg-').replace('border-', 'border-')}`} />
                        <span>{c.name}</span>
                    </div>
                ))}
                <div className="flex items-center space-x-1.5">
                    <div className="w-3 h-3 bg-red-400 border border-red-500 rounded-sm" />
                    <span>未割当/エラー</span>
                </div>
            </div>
        </div>
    );
};

export default DailyTimelineView;
