import React, { useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { X, GripVertical, Save } from 'lucide-react';
import { updateShift } from '../../lib/api';
import type { Shift, Staff, ClassType } from '../../types';

interface DailyTimelineModalProps {
    date: Date;
    shifts: Shift[];
    staffList: Staff[];
    onClose: () => void;
    onShiftUpdate?: () => void;
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

// 表示上の余白：実際の 8:00〜19:00 の前後に余裕を持たせる
const DISPLAY_START_MINS = 7 * 60 + 45; // 7:45
const DISPLAY_END_MINS = 19 * 60 + 15; // 19:15
const DISPLAY_TOTAL_MINS = DISPLAY_END_MINS - DISPLAY_START_MINS;

// ドラッグタイプ
type DragType = 'move' | 'resize-left' | 'resize-right';

interface DragState {
    shiftId: string;
    type: DragType;
    startX: number;
    startY: number;
    origStartMins: number;
    origEndMins: number;
    origClassType: ClassType;
    trackWidth: number;
}

const DailyTimelineModal: React.FC<DailyTimelineModalProps> = ({
    date,
    shifts,
    staffList,
    onClose,
    onShiftUpdate
}) => {
    const targetDateStr = format(date, 'yyyy-MM-dd');

    // ローカルの状態（ドラッグ中にリアルタイム更新するため）
    const [localShifts, setLocalShifts] = useState<Record<string, { start: number; end: number; classType: ClassType }>>(() => {
        const init: Record<string, { start: number; end: number; classType: ClassType }> = {};
        shifts.filter(s => s.date === targetDateStr).forEach(s => {
            init[s.id] = { start: toMins(s.startTime), end: toMins(s.endTime), classType: s.classType };
        });
        return init;
    });

    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragDeltaY, setDragDeltaY] = useState(0);
    const [hoveredGroup, setHoveredGroup] = useState<ClassType | null>(null);

    const dragRef = useRef<DragState | null>(null);
    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // 表示する時間目盛り（「9」「10」... の数字のみ）
    const hourLabels = Array.from({ length: (END_HOUR - START_HOUR) + 1 }, (_, i) => START_HOUR + i);

    const dayShifts = shifts
        .filter(s => s.date === targetDateStr)
        .sort((a, b) => {
            if (a.classType !== b.classType) return a.classType.localeCompare(b.classType);
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

    const getBarColor = (classType: string, isError?: boolean) => {
        if (isError) return 'bg-red-400 border-red-500';
        if (classType === '虹組') return 'bg-yellow-300 border-yellow-400';
        if (classType === 'スマイル組') return 'bg-blue-300 border-blue-400';
        if (classType === '特殊') return 'bg-emerald-300 border-emerald-400';
        return 'bg-purple-300 border-purple-400';
    };

    const calculateDuration = (startMins: number, endMins: number) => {
        const diff = endMins - startMins;
        if (diff < 0) return '??';
        return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
    };

    // ドラッグ開始
    const handleMouseDown = useCallback((
        e: React.MouseEvent,
        shiftId: string,
        type: DragType,
        trackEl: HTMLElement
    ) => {
        e.preventDefault();
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
            trackWidth: rect.width,
        };
        setActiveDragId(shiftId);
        setDragDeltaY(0);
        setHoveredGroup(s.classType);
    }, [localShifts]);

    // ドラッグ中
    const handleMouseMove = useCallback((e: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;

        const dx = e.clientX - drag.startX;
        const minsPerPx = DISPLAY_TOTAL_MINS / drag.trackWidth;
        const deltaMins = snapTo15(dx * minsPerPx);

        // 垂直ドラッグによるクラス判定（バーを浮かせる）
        let newClassType: ClassType = drag.origClassType;
        if (drag.type === 'move') {
            const dy = e.clientY - drag.startY;
            setDragDeltaY(dy);

            const groups: ClassType[] = ['スマイル組', '虹組', '特殊'];
            for (const cls of groups) {
                const el = groupRefs.current[cls];
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        newClassType = cls;
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

            if (drag.type === 'move') {
                newStart = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - (orig.end - orig.start), orig.start + deltaMins));
                newEnd = newStart + (orig.end - orig.start);
            } else if (drag.type === 'resize-left') {
                newStart = Math.max(START_HOUR * 60, Math.min(orig.end - MIN_DURATION, orig.start + deltaMins));
            } else if (drag.type === 'resize-right') {
                newEnd = Math.min(END_HOUR * 60, Math.max(orig.start + MIN_DURATION, orig.end + deltaMins));
            }

            // classType はここでは更新しない（mouseUpまで行を動かさない）
            return { ...prev, [drag.shiftId]: { ...prev[drag.shiftId], start: newStart, end: newEnd } };
        });
    }, []);

    // ドラッグ終了 → API保存
    const handleMouseUp = useCallback(async () => {
        const drag = dragRef.current;
        dragRef.current = null;

        const finalClassType = hoveredGroup;

        setActiveDragId(null);
        setDragDeltaY(0);
        setHoveredGroup(null);

        if (!drag) return;

        const s = localShifts[drag.shiftId];
        if (!s) return;

        const hasTimeChanged = s.start !== drag.origStartMins || s.end !== drag.origEndMins;
        const hasClassChanged = finalClassType !== drag.origClassType;

        if (!hasTimeChanged && !hasClassChanged) return;

        // 状態を最終決定
        setLocalShifts(prev => ({
            ...prev,
            [drag.shiftId]: { ...prev[drag.shiftId], classType: finalClassType || drag.origClassType }
        }));

        setSaving(drag.shiftId);
        try {
            await updateShift(drag.shiftId, {
                startTime: toTimeStr(s.start),
                endTime: toTimeStr(s.end),
                classType: finalClassType || drag.origClassType,
            });
            setSaved(drag.shiftId);
            setTimeout(() => setSaved(null), 3000);
            onShiftUpdate?.();
        } catch {
            // rollback
            setLocalShifts(prev => ({
                ...prev,
                [drag.shiftId]: { start: drag.origStartMins, end: drag.origEndMins, classType: drag.origClassType }
            }));
            alert('保存に失敗しました。');
        } finally {
            setSaving(null);
        }
    }, [localShifts, onShiftUpdate, hoveredGroup]);

    // 入力フォームから直接時間を変更
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

    const handleTimeInputBlur = async (shiftId: string) => {
        const s = localShifts[shiftId];
        if (!s) return;
        setSaving(shiftId);
        try {
            await updateShift(shiftId, {
                startTime: toTimeStr(s.start),
                endTime: toTimeStr(s.end),
                classType: s.classType,
            });
            setSaved(shiftId);
            setTimeout(() => setSaved(null), 2000);
            onShiftUpdate?.();
        } catch {
            alert('保存に失敗しました。');
        } finally {
            setSaving(null);
        }
    };

    // グローバルイベントをモーダル全体に設定
    const handleContainerMouseMove = (e: React.MouseEvent) => {
        handleMouseMove(e.nativeEvent);
    };
    const handleContainerMouseUp = () => {
        handleMouseUp();
    };

    // 15分ごとのグリッド線を描画（表示範囲 DISPLAY_START〜DISPLAY_END に合わせた座標）
    const renderGridLines = () => {
        const lines = [];
        const totalSlots = (END_HOUR - START_HOUR) * 4; // 15分刻み
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-auto select-none"
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
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
                    <button onClick={onClose} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 min-h-0">
                    <div className="min-w-[800px] border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden flex flex-col">

                        {/* Header Row: 時間ラベル */}
                        <div className="flex bg-slate-100 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 select-none relative z-20 sticky top-0">
                            {/* 左側の固定列ヘッダー */}
                            <div className="flex w-[330px] flex-shrink-0 bg-slate-100 dark:bg-slate-900">
                                <div className="w-28 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">名前</div>
                                <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">開始</div>
                                <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">終了</div>
                                <div className="w-14 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">時間</div>
                            </div>
                            {/* 時間ラベル：時のみ表示（DISPLAY範囲の座標に合わせて配置） */}
                            <div className="flex-1 relative h-8 bg-slate-100 dark:bg-slate-900">
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

                        {/* Shift Rows Grouped by Class */}
                        <div className="bg-white dark:bg-slate-800 pb-2">
                            {dayShifts.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">この日のシフトはありません。</div>
                            ) : (
                                ['スマイル組', '虹組', '特殊', 'unassigned'].map(groupClass => {
                                    // グループに属するシフトをフィルタリング（ローカル状態 localShifts に基づいて動的に移動する）
                                    const groupShifts = dayShifts.filter(shift => {
                                        const local = localShifts[shift.id];
                                        const currentClass = local ? local.classType : shift.classType;
                                        const isError = shift.isError; // Error状態は不変とするか、必要ならlocalに含める

                                        if (groupClass === 'unassigned') {
                                            return !['スマイル組', '虹組', '特殊'].includes(currentClass) || isError;
                                        }
                                        return currentClass === groupClass && !isError;
                                    });

                                    if (groupShifts.length === 0) return null;

                                    const groupTitle = groupClass === '特殊' ? 'ヘルプ' : groupClass === 'unassigned' ? '未割り当て/エラー' : groupClass;
                                    const titleColor = groupClass === 'スマイル組' ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' :
                                        groupClass === '虹組' ? 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-100 dark:border-yellow-800' :
                                            groupClass === '特殊' ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800' :
                                                'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800';

                                    return (
                                        <div
                                            key={groupClass}
                                            ref={el => { groupRefs.current[groupClass] = el; }}
                                            className="mb-4 last:mb-0 border-x border-b border-slate-200 dark:border-slate-700 shadow-sm rounded-b-lg transition-all duration-300"
                                        >
                                            {/* Group Header */}
                                            <div className={`px-4 py-2 text-sm font-bold border-t border-b transition-colors duration-200 ${hoveredGroup === groupClass ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : titleColor
                                                }`}>
                                                {groupTitle}
                                                {hoveredGroup === groupClass && activeDragId && (
                                                    <span className="ml-2 text-[10px] text-indigo-500 animate-pulse">ここへ移動</span>
                                                )}
                                            </div>
                                            {/* Group Items */}
                                            <div>
                                                {groupShifts.map((shift, idx) => {
                                                    const staff = staffList.find(s => s.id === shift.staffId);
                                                    const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');
                                                    const s = localShifts[shift.id] ?? { start: toMins(shift.startTime), end: toMins(shift.endTime), classType: shift.classType };
                                                    const isSaving = saving === shift.id;
                                                    const isSaved = saved === shift.id;
                                                    const isLast = idx === groupShifts.length - 1;

                                                    const isDragging = activeDragId === shift.id;

                                                    return (
                                                        <div
                                                            key={shift.id}
                                                            className={`flex ${!isLast ? 'border-b border-slate-200 dark:border-slate-700' : ''} transition-all duration-300
                                                                ${isSaved
                                                                    ? 'bg-emerald-100/80 dark:bg-emerald-900/50 border-y-2 border-emerald-500 z-10 shadow-lg'
                                                                    : isDragging ? 'opacity-40 bg-slate-100 dark:bg-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors'
                                                                }`}
                                                            style={isSaved ? { marginTop: '-1px', marginBottom: '-1px' } : {}}
                                                        >
                                                            {/* Info cells */}
                                                            <div className="flex w-[330px] flex-shrink-0 text-sm bg-white dark:bg-slate-800">
                                                                {/* 名前セクション */}
                                                                <div className="w-28 p-2 border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center overflow-hidden">
                                                                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate" title={staffName}>
                                                                        {staffName}
                                                                    </div>
                                                                    <div className="min-h-[1.25rem] mt-0.5">
                                                                        {isSaving && (
                                                                            <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium animate-pulse">
                                                                                保存中…
                                                                            </div>
                                                                        )}
                                                                        {isSaved && (
                                                                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                ✓ 保存済み
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* 開始時間入力（15分ステップ） */}
                                                                <div className="w-20 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center px-1">
                                                                    <input
                                                                        type="time"
                                                                        step="900"
                                                                        value={toTimeStr(s.start)}
                                                                        onChange={e => handleTimeInputChange(shift.id, 'start', e.target.value)}
                                                                        onBlur={() => handleTimeInputBlur(shift.id)}
                                                                        className="w-full text-center text-xs font-mono text-slate-700 dark:text-slate-300 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text"
                                                                        title="開始時間（15分単位）"
                                                                    />
                                                                </div>

                                                                {/* 終了時間入力（15分ステップ） */}
                                                                <div className="w-20 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center px-1">
                                                                    <input
                                                                        type="time"
                                                                        step="900"
                                                                        value={toTimeStr(s.end)}
                                                                        onChange={e => handleTimeInputChange(shift.id, 'end', e.target.value)}
                                                                        onBlur={() => handleTimeInputBlur(shift.id)}
                                                                        className="w-full text-center text-xs font-mono text-slate-700 dark:text-slate-300 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text"
                                                                        title="終了時間（15分単位）"
                                                                    />
                                                                </div>

                                                                {/* 勤務時間 */}
                                                                <div className="w-14 p-2 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold tabular-nums text-xs">
                                                                    {calculateDuration(s.start, s.end)}
                                                                </div>
                                                            </div>

                                                            {/* Timeline track */}
                                                            <div
                                                                className="flex-1 relative py-2 min-h-[52px] bg-white dark:bg-slate-800"
                                                                id={`track-${shift.id}`}
                                                            >
                                                                {renderGridLines()}

                                                                {/* Shift Bar */}
                                                                <div
                                                                    className={`absolute top-2 bottom-2 rounded border shadow flex items-center
                                                                        ${getBarColor(isDragging && hoveredGroup ? hoveredGroup : s.classType, shift.isError)}
                                                                        ${isSaving ? 'opacity-60' : ''}
                                                                        ${isDragging ? 'z-50 shadow-2xl scale-105 opacity-100 ring-2 ring-indigo-500 cursor-grabbing' : 'z-10 cursor-grab active:cursor-grabbing hover:scale-[1.02]'}
                                                                        transition-all duration-75`}
                                                                    style={{
                                                                        ...getBarStyle(shift.id),
                                                                        transform: isDragging ? `translateY(${dragDeltaY}px)` : 'none'
                                                                    }}
                                                                    onMouseDown={e => {
                                                                        const trackEl = document.getElementById(`track-${shift.id}`);
                                                                        if (trackEl) handleMouseDown(e, shift.id, 'move', trackEl);
                                                                    }}
                                                                >
                                                                    {/* Left resize handle */}
                                                                    <div
                                                                        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-20 rounded-l"
                                                                        onMouseDown={e => {
                                                                            e.stopPropagation();
                                                                            const trackEl = document.getElementById(`track-${shift.id}`);
                                                                            if (trackEl) handleMouseDown(e, shift.id, 'resize-left', trackEl);
                                                                        }}
                                                                    >
                                                                        <div className="w-0.5 h-4 bg-slate-600/40 rounded-full" />
                                                                    </div>

                                                                    {/* Label */}
                                                                    <div className="flex-1 px-3 text-[11px] font-semibold text-slate-700 dark:text-slate-800 truncate text-center select-none pointer-events-none">
                                                                        <GripVertical className="inline w-3 h-3 mr-1 opacity-40" />
                                                                        {staffName}
                                                                    </div>

                                                                    {/* Right resize handle */}
                                                                    <div
                                                                        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-20 rounded-r"
                                                                        onMouseDown={e => {
                                                                            e.stopPropagation();
                                                                            const trackEl = document.getElementById(`track-${shift.id}`);
                                                                            if (trackEl) handleMouseDown(e, shift.id, 'resize-right', trackEl);
                                                                        }}
                                                                    >
                                                                        <div className="w-0.5 h-4 bg-slate-600/40 rounded-full" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-yellow-300 border border-yellow-400 rounded-sm" /><span>虹組</span></div>
                        <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-blue-300 border border-blue-400 rounded-sm" /><span>スマイル組</span></div>
                        <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-emerald-300 border border-emerald-400 rounded-sm" /><span>ヘルプ/特殊</span></div>
                        <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-red-400 border border-red-500 rounded-sm" /><span>エラー</span></div>
                        <div className="flex items-center space-x-2 ml-auto">
                            <Save className="w-3 h-3" />
                            <span>ドラッグ終了 / 入力欄のフォーカスが外れたタイミングで自動保存</span>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default DailyTimelineModal;
