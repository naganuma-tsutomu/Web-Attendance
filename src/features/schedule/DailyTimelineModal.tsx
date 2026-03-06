import React, { useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { X, GripVertical, Save } from 'lucide-react';
import { updateShift } from '../../lib/api';
import type { Shift, Staff } from '../../types';

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
    origStartMins: number;
    origEndMins: number;
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

    // ローカルの時間状態（ドラッグ中にリアルタイム更新するため）
    const [localTimes, setLocalTimes] = useState<Record<string, { start: number; end: number }>>(() => {
        const init: Record<string, { start: number; end: number }> = {};
        shifts.filter(s => s.date === targetDateStr).forEach(s => {
            init[s.id] = { start: toMins(s.startTime), end: toMins(s.endTime) };
        });
        return init;
    });

    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    const dragRef = useRef<DragState | null>(null);

    // 表示する時間目盛り（「9」「10」... の数字のみ）
    const hourLabels = Array.from({ length: (END_HOUR - START_HOUR) + 1 }, (_, i) => START_HOUR + i);

    const dayShifts = shifts
        .filter(s => s.date === targetDateStr)
        .sort((a, b) => {
            if (a.classType !== b.classType) return a.classType.localeCompare(b.classType);
            return a.startTime.localeCompare(b.startTime);
        });

    const getBarStyle = (shiftId: string) => {
        const t = localTimes[shiftId];
        if (!t) return {};
        const clampedStart = Math.max(START_HOUR * 60, t.start);
        const clampedEnd = Math.min(END_HOUR * 60, t.end);
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
        const t = localTimes[shiftId];
        dragRef.current = {
            shiftId,
            type,
            startX: e.clientX,
            origStartMins: t.start,
            origEndMins: t.end,
            trackWidth: rect.width,
        };
    }, [localTimes]);

    // ドラッグ中
    const handleMouseMove = useCallback((e: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;

        const dx = e.clientX - drag.startX;
        const minsPerPx = DISPLAY_TOTAL_MINS / drag.trackWidth;
        const deltaMins = snapTo15(dx * minsPerPx);

        setLocalTimes(prev => {
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

            return { ...prev, [drag.shiftId]: { start: newStart, end: newEnd } };
        });
    }, []);

    // ドラッグ終了 → API保存
    const handleMouseUp = useCallback(async () => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;

        const t = localTimes[drag.shiftId];
        if (!t) return;
        if (t.start === drag.origStartMins && t.end === drag.origEndMins) return;

        setSaving(drag.shiftId);
        try {
            await updateShift(drag.shiftId, {
                startTime: toTimeStr(t.start),
                endTime: toTimeStr(t.end),
            });
            setSaved(drag.shiftId);
            setTimeout(() => setSaved(null), 2000);
            onShiftUpdate?.();
        } catch {
            // rollback
            setLocalTimes(prev => ({
                ...prev,
                [drag.shiftId]: { start: drag.origStartMins, end: drag.origEndMins }
            }));
            alert('保存に失敗しました。');
        } finally {
            setSaving(null);
        }
    }, [localTimes, onShiftUpdate]);

    // 入力フォームから直接時間を変更（保存ボタン不要 → ドラッグと同じようにフォームblur時に保存）
    const handleTimeInputChange = (shiftId: string, field: 'start' | 'end', value: string) => {
        const mins = toMins(value);
        const snapped = snapTo15(mins);
        setLocalTimes(prev => {
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
        const t = localTimes[shiftId];
        if (!t) return;
        setSaving(shiftId);
        try {
            await updateShift(shiftId, {
                startTime: toTimeStr(t.start),
                endTime: toTimeStr(t.end),
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
                        ? 'border-slate-300'
                        : isHalf
                            ? 'border-slate-200 border-dashed'
                            : 'border-slate-100'
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
                className="bg-white rounded-2xl shadow-xl w-full max-w-6xl flex flex-col animate-in zoom-in-95 duration-200"
                style={{ maxHeight: 'calc(100vh - 4rem)' }}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">
                            {format(date, 'yyyy年M月d日 (E)', { locale: ja })}
                            <span className="text-slate-500 text-base font-normal ml-2">のタイムライン</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            バーをドラッグ・または左の入力欄で時間を変更できます（15分スナップ）
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 min-h-0">
                    <div className="min-w-[800px] border border-slate-300 rounded-lg overflow-hidden flex flex-col">

                        {/* Header Row: 時間ラベル */}
                        <div className="flex bg-slate-100 border-b border-slate-300 text-xs font-bold text-slate-700 select-none relative z-20 sticky top-0">
                            {/* 左側の固定列ヘッダー */}
                            <div className="flex w-[290px] flex-shrink-0 bg-slate-100">
                                <div className="w-28 p-2 border-r border-slate-300 flex items-center justify-center">名前</div>
                                <div className="w-16 p-2 border-r border-slate-300 flex items-center justify-center">開始</div>
                                <div className="w-16 p-2 border-r border-slate-300 flex items-center justify-center">終了</div>
                                <div className="w-14 p-2 border-r border-slate-300 flex items-center justify-center">時間</div>
                            </div>
                            {/* 時間ラベル：時のみ表示（DISPLAY範囲の座標に合わせて配置） */}
                            <div className="flex-1 relative h-8 bg-slate-100">
                                {hourLabels.map((h) => {
                                    const leftPct = ((h * 60 - DISPLAY_START_MINS) / DISPLAY_TOTAL_MINS) * 100;
                                    return (
                                        <div
                                            key={h}
                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[11px] font-semibold text-slate-500 bg-slate-100 px-0.5"
                                            style={{ left: `${leftPct}%` }}
                                        >
                                            {h}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Shift Rows */}
                        <div className="bg-white pb-2">
                            {dayShifts.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">この日のシフトはありません。</div>
                            ) : dayShifts.map(shift => {
                                const staff = staffList.find(s => s.id === shift.staffId);
                                const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');
                                const t = localTimes[shift.id] ?? { start: toMins(shift.startTime), end: toMins(shift.endTime) };
                                const isSaving = saving === shift.id;
                                const isSaved = saved === shift.id;

                                return (
                                    <div key={shift.id} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                        {/* Info cells */}
                                        <div className="flex w-[290px] flex-shrink-0 text-sm">
                                            {/* 名前 */}
                                            <div className="w-28 p-2 border-r border-slate-200 flex flex-col justify-center overflow-hidden">
                                                <div className="font-medium text-slate-800 truncate">{staffName}</div>
                                                <div className="text-[10px] text-slate-500">
                                                    {shift.classType === '特殊' ? 'ヘルプ' : shift.classType}
                                                </div>
                                                {isSaving && <div className="text-[10px] text-indigo-400">保存中…</div>}
                                                {isSaved && <div className="text-[10px] text-green-500">✓ 保存済</div>}
                                            </div>

                                            {/* 開始時間入力（15分ステップ） */}
                                            <div className="w-16 border-r border-slate-200 flex items-center justify-center px-1">
                                                <input
                                                    type="time"
                                                    step="900"
                                                    value={toTimeStr(t.start)}
                                                    onChange={e => handleTimeInputChange(shift.id, 'start', e.target.value)}
                                                    onBlur={() => handleTimeInputBlur(shift.id)}
                                                    className="w-full text-center text-xs font-mono text-slate-700 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text"
                                                    title="開始時間（15分単位）"
                                                />
                                            </div>

                                            {/* 終了時間入力（15分ステップ） */}
                                            <div className="w-16 border-r border-slate-200 flex items-center justify-center px-1">
                                                <input
                                                    type="time"
                                                    step="900"
                                                    value={toTimeStr(t.end)}
                                                    onChange={e => handleTimeInputChange(shift.id, 'end', e.target.value)}
                                                    onBlur={() => handleTimeInputBlur(shift.id)}
                                                    className="w-full text-center text-xs font-mono text-slate-700 border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded p-0.5 cursor-text"
                                                    title="終了時間（15分単位）"
                                                />
                                            </div>

                                            {/* 勤務時間 */}
                                            <div className="w-14 p-2 border-r border-slate-200 flex items-center justify-center text-slate-700 font-semibold tabular-nums text-xs">
                                                {calculateDuration(t.start, t.end)}
                                            </div>
                                        </div>

                                        {/* Timeline track */}
                                        <div
                                            className="flex-1 relative py-2 min-h-[52px]"
                                            id={`track-${shift.id}`}
                                        >
                                            {renderGridLines()}

                                            {/* Shift Bar */}
                                            <div
                                                className={`absolute top-2 bottom-2 rounded border shadow z-10 flex items-center
                                                    ${getBarColor(shift.classType, shift.isError)}
                                                    ${isSaving ? 'opacity-60' : ''}
                                                    transition-opacity cursor-grab active:cursor-grabbing`}
                                                style={getBarStyle(shift.id)}
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
                                                <div className="flex-1 px-3 text-[11px] font-semibold text-slate-700 truncate text-center select-none pointer-events-none">
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

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
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
        </div>
    );
};

export default DailyTimelineModal;
