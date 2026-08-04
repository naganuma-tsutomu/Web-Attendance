import { useQuery } from '@tanstack/react-query';
import { getClasses, getRoles, getShiftRequirements, getShiftRequirementTemplates, getTimePatterns } from '../api';
import { QUERY_KEYS } from './queryKeys';

export const useRoles = () => useQuery({ queryKey: QUERY_KEYS.roles, queryFn: getRoles });
export const useClasses = () => useQuery({ queryKey: QUERY_KEYS.classes, queryFn: getClasses });
export const useTimePatterns = () => useQuery({ queryKey: QUERY_KEYS.timePatterns, queryFn: getTimePatterns });
export const useShiftRequirements = () => useQuery({ queryKey: QUERY_KEYS.shiftRequirements, queryFn: getShiftRequirements });
export const useShiftRequirementTemplates = () => useQuery({
    queryKey: QUERY_KEYS.shiftRequirementTemplates,
    queryFn: getShiftRequirementTemplates,
});
