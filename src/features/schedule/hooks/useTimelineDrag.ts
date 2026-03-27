import { useState, useRef, useCallback } from 'react';
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

    const handlePointerDown = useCallback((
        e: React.PointerEvent, shiftId: string, type: DragType, trackEl: HTMLElement
    ) => {
        if (readOnly) return;
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
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [localShifts, readOnly]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;

        const dx = e.clientX - drag.startX;
        const minsPerPx = hours.displayTotalMins / drag.trackWidth;
        const deltaMins = snapTo15(dx * minsPerPx);

        let newClassType: ClassType | 'unassigned' = drag.origIsError ? 'unassigned' : drag.origClassType;
        if (drag.type === 'move') {
            setDragDeltaY(e.clientY - drag.startY);
            const groups: (string | 'unassigned')[] = [...classes.map(c => c.id), 'unassigned'];
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

        dispatch({ type: 'UPDATE_LOCAL_FN', updater: (prev) => {
            const orig = { start: drag.origStartMins, end: drag.origEndMins };
            let newStart = orig.start;
            let newEnd = orig.end;
            const isChangingClass = drag.type === 'move' && newClassType !== (drag.origIsError ? 'unassigned' : drag.origClassType);

            if (!isChangingClass) {
                if (drag.type === 'move') {
                    newStart = Math.max(hours.startHour * 60, Math.min(hours.endHour * 60 - (orig.end - orig.start), orig.start + deltaMins));
                    newEnd = newStart + (orig.end - orig.start);
                } else if (drag.type === 'resize-left') {
                    newStart = Math.max(hours.startHour * 60, Math.min(orig.end - SHIFT_STEP_MINS, orig.start + deltaMins));
                } else if (drag.type === 'resize-right') {
                    newEnd = Math.min(hours.endHour * 60, Math.max(orig.start + SHIFT_STEP_MINS, orig.end + deltaMins));
                }
            }

            return { ...prev, [drag.shiftId]: { ...prev[drag.shiftId], start: newStart, end: newEnd } };
        }});
    }, [classes, dispatch, hours]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        dragRef.current = null;
        const finalClassType = hoveredGroup;
        setActiveDragId(null);
        setDragDeltaY(0);
        setHoveredGroup(null);

        dispatch({ type: 'UPDATE_LOCAL', id: drag.shiftId, data: {
            classType: (finalClassType && finalClassType !== 'unassigned') ? finalClassType : drag.origClassType,
            isError: finalClassType === 'unassigned'
        }});
    }, [hoveredGroup, dispatch]);

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
