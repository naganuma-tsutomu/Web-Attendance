import React, { useRef } from 'react';
import { GripVertical } from 'lucide-react';
import { timeToMinutes } from '../../../utils/timeUtils';
import { toTimeStr } from '../hooks/useShiftEdit';
import type { DragType, LocalShiftData, BusinessHoursConfig } from '../hooks/useShiftEdit';
import type { Shift, ClassType, ShiftTimePattern } from '../../../types';

interface TimelineBarProps {
    shift: Shift;
    localData: LocalShiftData;
    isDragging: boolean;
    dragDeltaY: number;
    hoveredGroup: ClassType | 'unassigned' | null;
    highlightStaffId?: string;
    readOnly: boolean;
    classColorMap: Record<string, string>;
    timePatterns: ShiftTimePattern[];
    hours: BusinessHoursConfig;
    conflictType: 'training' | 'preference' | 'none';
    onPointerDown: (e: React.PointerEvent, shiftId: string, type: DragType, trackEl: HTMLElement) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    renderGridLines: () => React.ReactNode;
}

const getBarColor = (classType: ClassType | 'unassigned', isError?: boolean, conflictType?: 'training' | 'preference' | 'none') => {
    if (isError || classType === 'unassigned') return 'bg-slate-300 border-slate-400 dark:bg-slate-600 dark:border-slate-500';
    if (conflictType === 'training') return 'bg-amber-300 border-amber-400 dark:bg-amber-500/60 dark:border-amber-500';
    if (conflictType === 'preference') return 'bg-orange-300 border-orange-400 dark:bg-orange-500/60 dark:border-orange-500';
    if (classType === '虹組' || classType === 'class_niji') return 'bg-yellow-300 border-yellow-400';
    if (classType === 'スマイル組' || classType === 'class_smile') return 'bg-blue-300 border-blue-400';
    if (classType === '特殊' || classType === 'class_special') return 'bg-emerald-300 border-emerald-400';
    return 'bg-purple-300 border-purple-400';
};

const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const TimelineBar: React.FC<TimelineBarProps> = ({
    shift, localData, isDragging, dragDeltaY, hoveredGroup, highlightStaffId,
    readOnly, classColorMap, timePatterns, hours, conflictType,
    onPointerDown, onPointerUp, renderGridLines
}) => {
    const s = localData;
    const trackRef = useRef<HTMLDivElement>(null);

    const getBarStyle = () => {
        const clampedStart = Math.max(hours.startHour * 60, s.start);
        const clampedEnd = Math.min(hours.endHour * 60, s.end);
        const left = ((clampedStart - hours.displayStartMins) / hours.displayTotalMins) * 100;
        const width = ((clampedEnd - clampedStart) / hours.displayTotalMins) * 100;
        return { left: `${left}%`, width: `${Math.max(0.5, width)}%` };
    };

    const getShiftLabel = (startMins: number, endMins: number) => {
        const startTime = toTimeStr(startMins);
        const endTime = toTimeStr(endMins);
        const pattern = timePatterns.find(p => p.startTime === startTime && p.endTime === endTime);
        return pattern ? pattern.name : 'カスタム';
    };

    const currentClassType = isDragging && hoveredGroup ? hoveredGroup : (readOnly ? shift.classType : s.classType);
    const currentIsError = readOnly ? shift.isError : s.isError;
    const hexColor = !currentIsError && conflictType === 'none' ? classColorMap[currentClassType] : undefined;
    const barColorStyle = hexColor ? {
        backgroundColor: hexToRgba(hexColor, 0.55),
        borderColor: hexToRgba(hexColor, 0.85),
    } : {};

    const handleResizePointerDown = (e: React.PointerEvent, type: DragType) => {
        e.stopPropagation();
        if (readOnly) return;
        if (trackRef.current) onPointerDown(e, shift.id, type, trackRef.current);
    };

    return (
        <div className={`flex-1 relative ${readOnly ? 'py-1 min-h-[36px]' : 'py-2 min-h-[52px]'} w-full bg-white dark:bg-slate-800`} ref={trackRef} style={{ touchAction: 'pan-y' }}>
            {renderGridLines()}
            <div
                className={`absolute ${readOnly ? 'top-1 bottom-1' : 'top-2 bottom-2'} rounded flex items-center ${hexColor ? '' : getBarColor(currentClassType, currentIsError, conflictType)} ${isDragging ? 'z-50 shadow-2xl scale-105 opacity-100 ring-2 ring-indigo-500 cursor-grabbing' : highlightStaffId === shift.staffId ? 'z-20 ring-2 ring-indigo-500 ring-offset-1 border-indigo-400 shadow-md transform scale-[1.01]' : `z-10 border shadow ${readOnly ? '' : 'cursor-grab active:cursor-grabbing hover:scale-[1.02]'}`} transition-all duration-75`}
                style={{ ...getBarStyle(), ...barColorStyle, transform: isDragging ? `translateY(${dragDeltaY}px)` : 'none', ...(readOnly ? { pointerEvents: 'none' } : { touchAction: 'none' }) }}
                {...(!readOnly ? {
                    onPointerDown: (e: React.PointerEvent) => {
                        if (trackRef.current) onPointerDown(e, shift.id, 'move', trackRef.current);
                    },
                    onPointerUp,
                    onPointerCancel: onPointerUp,
                } : {})}
            >
                {!readOnly && (
                    <div className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-20 rounded-l transition-opacity hover:bg-black/5" onPointerDown={e => handleResizePointerDown(e, 'resize-left')}><div className="w-1 h-5 bg-slate-600/30 rounded-full" /></div>
                )}
                <div className="flex-1 px-1 sm:px-2 text-[9px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-800 truncate text-center select-none pointer-events-none uppercase tracking-tighter">
                    {!readOnly && <GripVertical className="inline w-3 h-3 mr-1 opacity-40" />}
                    {getShiftLabel(readOnly ? timeToMinutes(shift.startTime) : s.start, readOnly ? timeToMinutes(shift.endTime) : s.end)}
                </div>
                {!readOnly && (
                    <div className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-20 rounded-r transition-opacity hover:bg-black/5" onPointerDown={e => handleResizePointerDown(e, 'resize-right')}><div className="w-1 h-5 bg-slate-600/30 rounded-full" /></div>
                )}
            </div>
        </div>
    );
};

export default TimelineBar;
export { hexToRgba, getBarColor };
