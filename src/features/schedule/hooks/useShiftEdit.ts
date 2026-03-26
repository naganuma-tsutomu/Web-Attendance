import { useReducer, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { updateShift, saveShiftsBatch, deleteShift } from '../../../lib/api';
import { timeToMinutes } from '../../../utils/timeUtils';
import type { Shift, ClassType, ShiftTimePattern } from '../../../types';

// ── Default Constants ──

export const DEFAULT_START_HOUR = 8;
export const DEFAULT_END_HOUR = 19;

export interface BusinessHoursConfig {
    startHour: number;
    endHour: number;
    displayStartMins: number;
    displayEndMins: number;
    displayTotalMins: number;
}

export function resolveBusinessHours(bh?: { startHour?: number; endHour?: number } | null): BusinessHoursConfig {
    const startHour = bh?.startHour ?? DEFAULT_START_HOUR;
    const endHour = bh?.endHour ?? DEFAULT_END_HOUR;
    const displayStartMins = startHour * 60 - 15;
    const displayEndMins = endHour * 60 + 15;
    return { startHour, endHour, displayStartMins, displayEndMins, displayTotalMins: displayEndMins - displayStartMins };
}

// ── Helpers ──

export const toTimeStr = (mins: number): string => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const snapTo15 = (mins: number): number => Math.round(mins / 15) * 15;

// ── Types ──

export type DragType = 'move' | 'resize-left' | 'resize-right';

export type LocalShiftData = {
    start: number;
    end: number;
    classType: ClassType;
    isError: boolean;
};

export interface DragState {
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

interface ShiftEditState {
    localShifts: Record<string, LocalShiftData>;
    addedShifts: Shift[];
    deletedIds: Set<string>;
    initialShifts: Record<string, LocalShiftData>;
}

type ShiftEditAction =
    | { type: 'INIT'; payload: Record<string, LocalShiftData> }
    | { type: 'UPDATE_LOCAL'; id: string; data: Partial<LocalShiftData> }
    | { type: 'UPDATE_LOCAL_FN'; updater: (prev: Record<string, LocalShiftData>) => Record<string, LocalShiftData> }
    | { type: 'ADD_SHIFT'; shift: Shift; localData: LocalShiftData }
    | { type: 'REMOVE_SHIFT'; id: string }
    | { type: 'SWAP_STAFF'; oldId: string; newShift: Shift; localData: LocalShiftData };

// ── Reducer ──

function shiftEditReducer(state: ShiftEditState, action: ShiftEditAction): ShiftEditState {
    switch (action.type) {
        case 'INIT':
            return {
                localShifts: action.payload,
                initialShifts: action.payload,
                addedShifts: [],
                deletedIds: new Set(),
            };
        case 'UPDATE_LOCAL':
            return {
                ...state,
                localShifts: {
                    ...state.localShifts,
                    [action.id]: { ...state.localShifts[action.id], ...action.data },
                },
            };
        case 'UPDATE_LOCAL_FN':
            return {
                ...state,
                localShifts: action.updater(state.localShifts),
            };
        case 'ADD_SHIFT':
            return {
                ...state,
                addedShifts: [...state.addedShifts, action.shift],
                localShifts: { ...state.localShifts, [action.shift.id]: action.localData },
            };
        case 'REMOVE_SHIFT': {
            if (action.id.startsWith('temp-')) {
                const next = { ...state.localShifts };
                delete next[action.id];
                return {
                    ...state,
                    addedShifts: state.addedShifts.filter(s => s.id !== action.id),
                    localShifts: next,
                };
            }
            const nextDeleted = new Set(state.deletedIds);
            nextDeleted.add(action.id);
            return { ...state, deletedIds: nextDeleted };
        }
        case 'SWAP_STAFF': {
            const { oldId, newShift, localData } = action;
            const nextLocal = { ...state.localShifts, [newShift.id]: localData };
            let nextAdded = [...state.addedShifts, newShift];
            let nextDeleted = state.deletedIds;

            if (oldId.startsWith('temp-')) {
                nextAdded = nextAdded.filter(s => s.id !== oldId);
                delete nextLocal[oldId];
            } else {
                nextDeleted = new Set(nextDeleted);
                nextDeleted.add(oldId);
            }
            return { ...state, localShifts: nextLocal, addedShifts: nextAdded, deletedIds: nextDeleted };
        }
        default:
            return state;
    }
}

function buildInitialLocalShifts(shifts: Shift[], targetDateStr: string): Record<string, LocalShiftData> {
    const init: Record<string, LocalShiftData> = {};
    shifts.filter(s => s.date === targetDateStr).forEach(s => {
        init[s.id] = { start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime), classType: s.classType, isError: s.isError ?? false };
    });
    return init;
}

// ── Hook ──

interface UseShiftEditParams {
    shifts: Shift[];
    date: Date;
    staffList: { id: string; defaultWorkingHoursStart?: string; defaultWorkingHoursEnd?: string }[];
    timePatterns: ShiftTimePattern[];
    hours: BusinessHoursConfig;
    onShiftUpdate?: () => void;
    onModifiedChange?: (modified: boolean) => void;
    saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

export function useShiftEdit({
    shifts, date, staffList, timePatterns, hours, onShiftUpdate, onModifiedChange, saveRef
}: UseShiftEditParams) {
    const targetDateStr = format(date, 'yyyy-MM-dd');

    const [editState, dispatch] = useReducer(shiftEditReducer, { shifts, targetDateStr }, () => {
        const init = buildInitialLocalShifts(shifts, targetDateStr);
        return { localShifts: init, initialShifts: init, addedShifts: [], deletedIds: new Set<string>() };
    });

    const { localShifts, addedShifts, deletedIds, initialShifts } = editState;

    // Re-init on date/shifts change
    useEffect(() => {
        dispatch({ type: 'INIT', payload: buildInitialLocalShifts(shifts, targetDateStr) });
    }, [targetDateStr, shifts]);

    // Modified detection
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

    // Save
    const handleSave = useCallback(async () => {
        try {
            const hasInvalidUnassigned = Object.keys(localShifts).some(id => {
                if (deletedIds.has(id)) return false;
                const originalShift = [...shifts, ...addedShifts].find(shift => shift.id === id);
                if (!originalShift) return false;
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
            console.error(error);
            throw error;
        }
    }, [addedShifts, deletedIds, localShifts, initialShifts, shifts, onShiftUpdate]);

    useEffect(() => {
        if (saveRef) saveRef.current = handleSave;
    }, [saveRef, handleSave]);

    // ── Handlers ──

    const handlePatternChange = useCallback((shiftId: string, patternId: string) => {
        const pattern = timePatterns.find(p => p.id === patternId);
        if (!pattern) return;
        dispatch({ type: 'UPDATE_LOCAL', id: shiftId, data: {
            start: timeToMinutes(pattern.startTime),
            end: timeToMinutes(pattern.endTime)
        }});
    }, [timePatterns]);

    const handleTimeInputChange = useCallback((shiftId: string, field: 'start' | 'end', value: string) => {
        const mins = timeToMinutes(value);
        const snapped = snapTo15(mins);
        dispatch({ type: 'UPDATE_LOCAL_FN', updater: (prev) => {
            const curr = prev[shiftId];
            const MIN_DURATION = 15;
            if (field === 'start') {
                const newStart = Math.max(hours.startHour * 60, Math.min(curr.end - MIN_DURATION, snapped));
                return { ...prev, [shiftId]: { ...curr, start: newStart } };
            } else {
                const newEnd = Math.min(hours.endHour * 60, Math.max(curr.start + MIN_DURATION, snapped));
                return { ...prev, [shiftId]: { ...curr, end: newEnd } };
            }
        }});
    }, [hours]);

    const handleAddStaff = useCallback((staffId: string, classType: ClassType) => {
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
        dispatch({ type: 'ADD_SHIFT', shift: newShift, localData: {
            start: timeToMinutes(startTime),
            end: timeToMinutes(endTime),
            classType: classType,
            isError: false
        }});
    }, [staffList, targetDateStr]);

    const handleRemoveShift = useCallback((shiftId: string) => {
        dispatch({ type: 'REMOVE_SHIFT', id: shiftId });
    }, []);

    const handleSwapStaff = useCallback((oldShiftId: string, newStaffId: string) => {
        const oldShift = [...shifts.filter(s => s.date === targetDateStr), ...addedShifts].find(s => s.id === oldShiftId);
        if (!oldShift) return;

        const oldLocal = localShifts[oldShiftId] || {
            start: timeToMinutes(oldShift.startTime),
            end: timeToMinutes(oldShift.endTime),
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

        dispatch({ type: 'SWAP_STAFF', oldId: oldShiftId, newShift, localData: { ...oldLocal, isError: false } });
    }, [shifts, addedShifts, localShifts, targetDateStr]);

    return {
        localShifts, addedShifts, deletedIds, initialShifts,
        isModified, dispatch, targetDateStr,
        handlePatternChange, handleTimeInputChange,
        handleAddStaff, handleRemoveShift, handleSwapStaff,
    };
}
