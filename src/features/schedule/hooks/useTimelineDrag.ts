import { useState, useRef, useCallback, useEffect } from 'react';
import { snapTo15 } from './useShiftEdit';
import { SHIFT_STEP_MINS } from '../../../constants';
import type { DragState, DragType, LocalShiftData } from './useShiftEdit';
import type { ClassType, ShiftClass } from '../../../types';

interface BusinessHoursResolved {
    startHour: number;
    endHour: number;
    displayStartMins: number;
    displayTotalMins: number;
}

interface UseTimelineDragProps {
    localShifts: Record<string, LocalShiftData>;
    classes: ShiftClass[];
    hours: BusinessHoursResolved;
    readOnly: boolean;
    dispatch: (action: { type: 'UPDATE_LOCAL_FN'; updater: (prev: Record<string, LocalShiftData>) => Record<string, LocalShiftData> } | { type: 'UPDATE_LOCAL'; id: string; data: Partial<LocalShiftData> }) => void;
}

export const useTimelineDrag = ({ localShifts, classes, hours, readOnly, dispatch }: UseTimelineDragProps) => {
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [dragDeltaY, setDragDeltaY] = useState(0);
    const [hoveredGroup, setHoveredGroup] = useState<ClassType | 'unassigned' | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // refs で最新値を保持（window リスナーからアクセスするため）
    const classesRef = useRef(classes);
    classesRef.current = classes;
    const hoursRef = useRef(hours);
    hoursRef.current = hours;
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;
    const hoveredGroupRef = useRef(hoveredGroup);
    hoveredGroupRef.current = hoveredGroup;

    const handlePointerDown = useCallback((
        e: React.PointerEvent, shiftId: string, type: DragType, trackEl: HTMLElement
    ) => {
        if (readOnly) return;
        e.preventDefault();
        const rect = trackEl.getBoundingClientRect();
        const s = localShifts[shiftId];
        dragRef.current = {
            shiftId, type, startX: e.clientX, startY: e.clientY,
            origStartMins: s.start, origEndMins: s.end,
            origClassType: s.classType, origIsError: s.isError,
            trackWidth: rect.width,
        };
        setActiveDragId(shiftId);
        setDragDeltaY(0);
        setHoveredGroup(s.isError ? 'unassigned' : s.classType);
    }, [localShifts, readOnly]);

    // window レベルでの pointermove / pointerup リスナー
    useEffect(() => {
        if (!activeDragId) return;

        const onMove = (e: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;

            const h = hoursRef.current;
            const cls = classesRef.current;

            const dx = e.clientX - drag.startX;
            const minsPerPx = h.displayTotalMins / drag.trackWidth;
            const deltaMins = snapTo15(dx * minsPerPx);

            let newClassType: ClassType | 'unassigned' = drag.origIsError ? 'unassigned' : drag.origClassType;
            if (drag.type === 'move') {
                setDragDeltaY(e.clientY - drag.startY);
                const groups: (string | 'unassigned')[] = [...cls.map(c => c.id), 'unassigned'];
                for (const clsId of groups) {
                    const el = groupRefs.current[clsId];
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                            newClassType = clsId as ClassType | 'unassigned';
                            break;
                        }
                    }
                }
                setHoveredGroup(newClassType);
                hoveredGroupRef.current = newClassType;
            }

            dispatchRef.current({ type: 'UPDATE_LOCAL_FN', updater: (prev) => {
                const orig = { start: drag.origStartMins, end: drag.origEndMins };
                let newStart = orig.start;
                let newEnd = orig.end;
                const isChangingClass = drag.type === 'move' && newClassType !== (drag.origIsError ? 'unassigned' : drag.origClassType);

                if (!isChangingClass) {
                    if (drag.type === 'move') {
                        newStart = Math.max(h.startHour * 60, Math.min(h.endHour * 60 - (orig.end - orig.start), orig.start + deltaMins));
                        newEnd = newStart + (orig.end - orig.start);
                    } else if (drag.type === 'resize-left') {
                        newStart = Math.max(h.startHour * 60, Math.min(orig.end - SHIFT_STEP_MINS, orig.start + deltaMins));
                    } else if (drag.type === 'resize-right') {
                        newEnd = Math.min(h.endHour * 60, Math.max(orig.start + SHIFT_STEP_MINS, orig.end + deltaMins));
                    }
                }

                return { ...prev, [drag.shiftId]: { ...prev[drag.shiftId], start: newStart, end: newEnd } };
            }});
        };

        const onUp = (_e: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            dragRef.current = null;
            const finalClassType = hoveredGroupRef.current;
            setActiveDragId(null);
            setDragDeltaY(0);
            setHoveredGroup(null);

            dispatchRef.current({ type: 'UPDATE_LOCAL', id: drag.shiftId, data: {
                classType: (finalClassType && finalClassType !== 'unassigned') ? finalClassType : drag.origClassType,
                isError: finalClassType === 'unassigned'
            }});
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);

        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [activeDragId]);

    // DailyTimelineView の onPointerMove / onPointerUp は互換性のために残す（既存の JSX バインディング用）
    const handlePointerMove = useCallback((_e: React.PointerEvent) => {
        // window レベルのリスナーで処理するため不要
    }, []);

    const handlePointerUp = useCallback((_e: React.PointerEvent) => {
        // window レベルのリスナーで処理するため不要
    }, []);

    return {
        activeDragId,
        dragDeltaY,
        hoveredGroup,
        groupRefs,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    };
};
