import React from 'react';
import type { Shift, Staff, ShiftClass, DynamicRole, ClassType, ShiftTimePattern } from '../../../types';
import type { LocalShiftData, DragType, BusinessHoursConfig } from '../hooks/useShiftEdit';
import { AddStaffMenu, type OffDutyStaffInfo } from './ShiftActionMenus';
import ShiftRow from './ShiftRow';
import { getEffectiveDutyNumber } from '../../../utils/dutyNumber';
import { hexToRgba } from './TimelineBar';
import { buildLeaderMatcher } from '../../../utils/roleMatch';

interface ShiftClassGroupProps {
    cls: ShiftClass;
    dayShifts: Shift[];
    localShifts: Record<string, LocalShiftData>;
    staffList: Staff[];
    classes: ShiftClass[];
    roles: DynamicRole[];
    leaderRoleId: string | null;
    date: Date;
    readOnly: boolean;
    showDutyNumbers: boolean;
    hoveredGroup: string | null;
    activeDragId: string | null;
    dragDeltaY: number;
    showAddMenu: string | null;
    showSwapMenu: string | null;
    deleteConfirmId: string | null;
    highlightStaffId?: string;
    classColorMap: Record<string, string>;
    timePatterns: ShiftTimePattern[];
    hours: BusinessHoursConfig;
    groupRef: (el: HTMLDivElement | null) => void;
    onToggleAddMenu: (id: string | null) => void;
    onAddStaff: (staffId: string, classType: ClassType) => void;
    onToggleSwapMenu: (id: string | null) => void;
    onToggleDeleteConfirm: (id: string | null) => void;
    onSwapStaff: (oldId: string, newId: string) => void;
    onRemoveShift: (id: string) => void;
    onDutyNumberUpdate: (id: string, value: number | null) => void;
    onPointerDown: (e: React.PointerEvent, id: string, type: DragType, trackEl: HTMLElement) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    renderGridLines: () => React.ReactNode;
    onMobileEdit: (id: string) => void;
    getShiftConflictType: (staffId: string, start: number, end: number) => 'training' | 'preference' | 'none';
    offDutyStaff: OffDutyStaffInfo[];
    staffMonthlyHours: Record<string, number>;
}

const ShiftClassGroup: React.FC<ShiftClassGroupProps> = ({
    cls, dayShifts, localShifts, staffList, classes, roles, leaderRoleId, date,
    readOnly, showDutyNumbers, hoveredGroup, activeDragId, dragDeltaY, showAddMenu,
    showSwapMenu, deleteConfirmId, highlightStaffId, classColorMap, timePatterns, hours,
    groupRef, onToggleAddMenu, onAddStaff, onToggleSwapMenu, onToggleDeleteConfirm,
    onSwapStaff, onRemoveShift, onDutyNumberUpdate, onPointerDown, onPointerUp, renderGridLines, onMobileEdit,
    getShiftConflictType, offDutyStaff, staffMonthlyHours
}) => {
    const groupShifts = dayShifts.filter(shift => {
        const local = localShifts[shift.id];
        const currentClassId = local ? local.classType : shift.classType;
        const isError = local ? local.isError : shift.isError;
        if (cls.id === 'unassigned') return (isError || !classes.some(c => c.id === currentClassId));
        return currentClassId === cls.id && !isError;
    });

    if (groupShifts.length === 0 && (cls.id === 'unassigned' || readOnly)) return null;

    const groupStaffIds = groupShifts.map(gs => gs.staffId);
    const matcher = buildLeaderMatcher(leaderRoleId, roles);
    const fullTimeGroupIds = leaderRoleId
        ? groupStaffIds.filter(id => {
            const s = staffList.find(st => st.id === id);
            return s ? matcher(s) : false;
        })
        : undefined;

    const getPendingDuty = (s: Shift): number | null | undefined => {
        const localDuty = localShifts[s.id]?.dutyNumber;
        return localDuty !== undefined ? localDuty : s.duty_number;
    };

    const sortedGroupShifts = showDutyNumbers
        ? [...groupShifts].sort((a, b) =>
            getEffectiveDutyNumber(a.staffId, getPendingDuty(a), date, groupStaffIds, fullTimeGroupIds) -
            getEffectiveDutyNumber(b.staffId, getPendingDuty(b), date, groupStaffIds, fullTimeGroupIds)
        )
        : groupShifts;

    const groupTitle = cls.name;
    const titleCustomStyle = cls.color && hoveredGroup !== cls.id ? {
        backgroundColor: hexToRgba(cls.color, 0.12),
        borderColor: hexToRgba(cls.color, 0.25),
    } : {};

    return (
        <div
            ref={groupRef}
            className={`mb-2 last:mb-0 border border-slate-200 dark:border-slate-700 shadow-sm relative ${
                dayShifts.some(s => (showSwapMenu === s.id || deleteConfirmId === s.id) && (localShifts[s.id]?.classType === cls.id || (s.classType === cls.id && !localShifts[s.id]))) || showAddMenu === cls.id
                ? 'z-50 overflow-visible' : 'z-[5] overflow-visible'
            }`}
        >
            <div
                className={`px-4 py-1 text-sm font-bold border-t border-b flex items-center justify-between transition-colors sticky top-0 z-30 ${hoveredGroup === cls.id ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-700 dark:text-slate-200'}`}
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
                        onToggle={onToggleAddMenu}
                        onAddStaff={onAddStaff}
                    />
                )}
            </div>

            <div>
                {groupShifts.length === 0 && (
                    <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-[10px]">人員が割り当てられていません</div>
                )}
                {sortedGroupShifts.map((shift) => {
                    const staff = staffList.find(s => s.id === shift.staffId);
                    const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');
                    const s = localShifts[shift.id];
                    const pendingDuty = getPendingDuty(shift);

                    return (
                        <ShiftRow
                            key={shift.id}
                            shift={shift}
                            staff={staff}
                            staffName={staffName}
                            localData={s}
                            isDragging={activeDragId === shift.id}
                            dragDeltaY={dragDeltaY}
                            hoveredGroup={hoveredGroup}
                            readOnly={readOnly}
                            showDutyNumbers={showDutyNumbers}
                            highlightStaffId={highlightStaffId}
                            conflictType={!s.isError ? getShiftConflictType(shift.staffId, s.start, s.end) : 'none'}
                            classColorMap={classColorMap}
                            timePatterns={timePatterns}
                            hours={hours}
                            onPointerDown={onPointerDown}
                            onPointerUp={onPointerUp}
                            renderGridLines={renderGridLines}
                            showSwapMenu={showSwapMenu}
                            deleteConfirmId={deleteConfirmId}
                            onToggleSwap={onToggleSwapMenu}
                            onToggleDelete={onToggleDeleteConfirm}
                            onSwapStaff={onSwapStaff}
                            onRemoveShift={onRemoveShift}
                            onDutyNumberUpdate={onDutyNumberUpdate}
                            onMobileEdit={onMobileEdit}
                            groupShiftsCount={groupShifts.length}
                            effectiveDutyNumber={getEffectiveDutyNumber(shift.staffId, pendingDuty, date, groupStaffIds, fullTimeGroupIds)}
                            isDutyAuto={pendingDuty == null}
                            offDutyStaff={offDutyStaff}
                            staffMonthlyHours={staffMonthlyHours}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default ShiftClassGroup;
