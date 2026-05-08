import type { Staff, DynamicRole } from '../types';

export const isLeaderRole = (
    staff: Staff,
    leaderRoleId: string | null | undefined,
    roles: DynamicRole[]
): boolean => {
    if (!leaderRoleId) return false;
    const role = roles.find(r => r.id === staff.role || r.name === staff.role);
    return role?.id === leaderRoleId;
};

export const buildLeaderMatcher = (
    leaderRoleId: string | null | undefined,
    roles: DynamicRole[]
): ((staff: Staff) => boolean) => {
    if (!leaderRoleId) return () => false;
    const roleValueToId = new Map<string, string>();
    for (const r of roles) {
        roleValueToId.set(r.id, r.id);
        roleValueToId.set(r.name, r.id);
    }
    return (staff: Staff) => roleValueToId.get(staff.role) === leaderRoleId;
};
