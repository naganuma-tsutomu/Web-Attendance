import React, { useState, useCallback, useMemo } from 'react';
import { useBusinessHours, useBreakSettings } from '../../lib/hooks';
import { timeToMinutes } from '../../utils/timeUtils';
import { useShiftEdit, resolveBusinessHours } from './hooks/useShiftEdit';
import { useTimelineDrag } from './hooks/useTimelineDrag';
import { useDailyTimelineData, useTimelineHourLabels } from './hooks/useDailyTimelineData';
import { TimelineFixedToggle, TimelineHeaderRows } from './components/TimelineHeaderRows';
import MobileShiftEditController from './components/MobileShiftEditController';
import OffDutySection from './components/OffDutySection';
import ShiftClassGroup from './components/ShiftClassGroup';
import type { Shift, Staff, ShiftClass, ShiftTimePattern, DynamicRole, ShiftPreference } from '../../types';

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
    discardRef?: React.MutableRefObject<(() => void) | null>;
    readOnly?: boolean;
    isFixed?: boolean;
    onToggleFixed?: () => void;
    hideHeaderToggle?: boolean;
    highlightStaffId?: string;
    showDutyNumbers?: boolean;
    leaderRoleId?: string | null;
    expectedVersion?: number;
}

const DailyTimelineView: React.FC<DailyTimelineViewProps> = ({
    date, shifts, staffList, classes, timePatterns, roles,
    preferences = [], onShiftUpdate, onModifiedChange, saveRef, discardRef,
    readOnly = false, isFixed = false, onToggleFixed, hideHeaderToggle, highlightStaffId,
    showDutyNumbers = false,
    leaderRoleId = null,
    expectedVersion,
}) => {
    const { data: businessHoursData } = useBusinessHours();
    const { data: breakSettings } = useBreakSettings();
    const hours = useMemo(() => resolveBusinessHours(businessHoursData), [businessHoursData]);

    const edit = useShiftEdit({
        shifts, date, staffList, timePatterns, hours, onShiftUpdate, onModifiedChange, saveRef, discardRef,
        expectedVersion,
    });
    const { localShifts, addedShifts, deletedIds, targetDateStr } = edit;

    const [showAddMenu, setShowAddMenu] = useState<string | null>(null);
    const [showSwapMenu, setShowSwapMenu] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [mobileEditShiftId, setMobileEditShiftId] = useState<string | null>(null);

    const {
        activeDragId,
        dragDeltaY,
        hoveredGroup,
        groupRefs,
        handlePointerMove,
        handlePointerUp,
        handlePointerDown,
    } = useTimelineDrag({ localShifts, classes, hours, readOnly, dispatch: edit.dispatch });

    const hourLabels = useTimelineHourLabels(hours);
    const { dayShifts, staffMonthlyHours, offDutyStaff, classColorMap } = useDailyTimelineData({
        date, shifts, staffList, classes, preferences, targetDateStr, addedShifts, deletedIds, breakSettings,
    });

    const getShiftConflictType = useCallback((staffId: string, shiftStartMins: number, shiftEndMins: number): 'training' | 'preference' | 'none' => {
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
    }, [preferences, targetDateStr]);

    const handleDutyNumberUpdate = (shiftId: string, value: number | null) => {
        edit.dispatch({ type: 'UPDATE_LOCAL', id: shiftId, data: { dutyNumber: value } });
    };

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
                    className={`absolute top-0 bottom-0 border-l z-0 pointer-events-none ${
                        isHour
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

    return (
        <div
            className={`select-none ${activeDragId ? 'touch-none overflow-hidden' : 'touch-pan-y overflow-auto'} flex-shrink-0 flex flex-col ${readOnly ? '' : 'flex-1 min-h-0'}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {!readOnly && onToggleFixed && !hideHeaderToggle && (
                <TimelineFixedToggle isFixed={isFixed} onToggleFixed={onToggleFixed} />
            )}

            <div className={`${readOnly ? 'min-w-full' : 'min-w-full md:min-w-[800px]'} overflow-visible flex flex-col bg-white dark:bg-slate-800`}>
                <TimelineHeaderRows
                    readOnly={readOnly}
                    showDutyNumbers={showDutyNumbers}
                    hourLabels={hourLabels}
                    displayStartMins={hours.displayStartMins}
                    displayTotalMins={hours.displayTotalMins}
                />

                <div className="pb-2">
                    {[...classes, { id: 'unassigned', name: '未割り当て' } as ShiftClass].map(cls => (
                        <ShiftClassGroup
                            key={cls.id}
                            cls={cls}
                            dayShifts={dayShifts}
                            localShifts={localShifts}
                            staffList={staffList}
                            classes={classes}
                            roles={roles}
                            leaderRoleId={leaderRoleId}
                            date={date}
                            readOnly={readOnly}
                            showDutyNumbers={showDutyNumbers}
                            hoveredGroup={hoveredGroup}
                            activeDragId={activeDragId}
                            dragDeltaY={dragDeltaY}
                            showAddMenu={showAddMenu}
                            showSwapMenu={showSwapMenu}
                            deleteConfirmId={deleteConfirmId}
                            highlightStaffId={highlightStaffId}
                            classColorMap={classColorMap}
                            timePatterns={timePatterns}
                            breakSettings={breakSettings}
                            hours={hours}
                            groupRef={el => { groupRefs.current[cls.id] = el; }}
                            onToggleAddMenu={setShowAddMenu}
                            onAddStaff={edit.handleAddStaff}
                            onToggleSwapMenu={setShowSwapMenu}
                            onToggleDeleteConfirm={setDeleteConfirmId}
                            onSwapStaff={edit.handleSwapStaff}
                            onRemoveShift={edit.handleRemoveShift}
                            onDutyNumberUpdate={handleDutyNumberUpdate}
                            onPatternChange={(id, patternId) => edit.dispatch({ type: 'UPDATE_SHIFT_PATTERN', id, patternId })}
                            onTimeChange={(id, field, value) => edit.dispatch({ type: 'UPDATE_SHIFT_TIME', id, field, value })}
                            onPointerDown={handlePointerDown}
                            onPointerUp={handlePointerUp}
                            renderGridLines={renderGridLines}
                            onMobileEdit={setMobileEditShiftId}
                            getShiftConflictType={getShiftConflictType}
                            offDutyStaff={offDutyStaff}
                            staffMonthlyHours={staffMonthlyHours}
                        />
                    ))}
                </div>

                {!readOnly && (
                    <OffDutySection
                        offDutyStaff={offDutyStaff}
                        classes={classes}
                        readOnly={readOnly}
                        showAddMenu={showAddMenu}
                        onToggleAddMenu={setShowAddMenu}
                        onAddStaff={edit.handleAddStaff}
                    />
                )}
            </div>

            {mobileEditShiftId && (
                <MobileShiftEditController
                    shiftId={mobileEditShiftId}
                    dayShifts={dayShifts}
                    staffList={staffList}
                    localShifts={localShifts}
                    roles={roles}
                    date={date}
                    leaderRoleId={leaderRoleId}
                    showDutyNumbers={showDutyNumbers}
                    offDutyStaff={offDutyStaff}
                    staffMonthlyHours={staffMonthlyHours}
                    onClose={() => setMobileEditShiftId(null)}
                    onPatternChange={(id, patternId) => edit.dispatch({ type: 'UPDATE_SHIFT_PATTERN', id, patternId })}
                    onTimeChange={(id, field, value) => edit.dispatch({ type: 'UPDATE_SHIFT_TIME', id, field, value })}
                    onDutyNumberChange={(id, value) => edit.dispatch({ type: 'UPDATE_LOCAL', id, data: { dutyNumber: value } })}
                    onSwapStaff={edit.handleSwapStaff}
                    onDeleteShift={edit.handleRemoveShift}
                />
            )}
        </div>
    );
};

export default DailyTimelineView;
