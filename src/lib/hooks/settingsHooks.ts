import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getBreakSettings, getBusinessHours, getExcelSettings, getFacilityName, getRotationSettings,
    getSchedulePreferences, updateBreakSettings, updateBusinessHours, updateExcelSettings,
    updateFacilityName, updateRotationSettings, updateSchedulePreferences,
} from '../api';
import type { BreakSettings, BusinessHours, ExcelSettings, RotationSettings, SchedulePreferences } from '../../types';
import { QUERY_KEYS } from './queryKeys';

const useInvalidateMutation = <T>(mutationFn: (data: T) => Promise<void>, queryKey: string[]) => {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn, onSuccess: () => { queryClient.invalidateQueries({ queryKey }); } });
};

export const useBusinessHours = () => useQuery({
    queryKey: QUERY_KEYS.businessHours, queryFn: getBusinessHours, staleTime: 30 * 60 * 1000,
});
export const useUpdateBusinessHours = () => useInvalidateMutation<BusinessHours>(updateBusinessHours, QUERY_KEYS.businessHours);

export const useExcelSettings = () => useQuery({ queryKey: QUERY_KEYS.excelSettings, queryFn: getExcelSettings });
export const useUpdateExcelSettings = () => useInvalidateMutation<ExcelSettings>(updateExcelSettings, QUERY_KEYS.excelSettings);

export const useSchedulePreferences = () => useQuery({
    queryKey: QUERY_KEYS.schedulePreferences, queryFn: getSchedulePreferences, staleTime: 30 * 60 * 1000,
});
export const useUpdateSchedulePreferences = () => useInvalidateMutation<SchedulePreferences>(updateSchedulePreferences, QUERY_KEYS.schedulePreferences);

export const useFacilityName = () => useQuery({
    queryKey: QUERY_KEYS.facilityName, queryFn: getFacilityName, staleTime: 30 * 60 * 1000,
});
export const useUpdateFacilityName = () => useInvalidateMutation<string>(updateFacilityName, QUERY_KEYS.facilityName);

export const useRotationSettings = () => useQuery({
    queryKey: QUERY_KEYS.rotationSettings, queryFn: getRotationSettings, staleTime: 30 * 60 * 1000,
});
export const useUpdateRotationSettings = () => useInvalidateMutation<RotationSettings>(updateRotationSettings, QUERY_KEYS.rotationSettings);

export const useBreakSettings = () => useQuery({
    queryKey: QUERY_KEYS.breakSettings, queryFn: getBreakSettings, staleTime: 30 * 60 * 1000,
});
export const useUpdateBreakSettings = () => useInvalidateMutation<BreakSettings>(updateBreakSettings, QUERY_KEYS.breakSettings);
