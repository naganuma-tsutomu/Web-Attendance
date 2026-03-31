import { format } from 'date-fns';
import { Save, X, Clock } from 'lucide-react';
import { useBreakSettings } from '../../../lib/hooks';
import { calculateActualWorkingHours, calculateDuration, calculateBreakMinutes } from '../../../utils/timeUtils';
import type { Staff } from '../../../types';
import type { EditFormData, CalendarEvent } from '../hooks/useScheduleData';

interface ShiftEditModalProps {
    selectedEvent: CalendarEvent | null;
    editFormData: EditFormData;
    currentDate: Date;
    staffList: Staff[];
    onFormChange: (data: EditFormData) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}

const ShiftEditModal = ({
    selectedEvent,
    editFormData,
    currentDate,
    staffList,
    onFormChange,
    onSubmit,
    onClose,
}: ShiftEditModalProps) => {
    const { data: breakSettings } = useBreakSettings();

    // 実働時間・休憩時間の計算
    const duration = calculateDuration(editFormData.startTime, editFormData.endTime);
    const actualHours = breakSettings?.displayActualHoursInModal
        ? calculateActualWorkingHours(editFormData.startTime, editFormData.endTime, breakSettings)
        : duration;
    const breakMins = calculateBreakMinutes(editFormData.startTime, editFormData.endTime, breakSettings);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    {selectedEvent ? 'シフトの修正' : '予定の新規追加'}
                </h3>
                <button onClick={onClose} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>
            <form onSubmit={onSubmit} className="p-6 space-y-4">
                {!selectedEvent && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">日付</label>
                        <input
                            type="date"
                            required
                            value={editFormData.date}
                            min={format(currentDate, 'yyyy-MM-01')}
                            max={format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'yyyy-MM-dd')}
                            onChange={e => onFormChange({ ...editFormData, date: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white"
                        />
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">担当スタッフ</label>
                    <select
                        value={editFormData.staffId}
                        onChange={e => onFormChange({ ...editFormData, staffId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white"
                    >
                        <option value="">未割り当て</option>
                        {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">開始時間</label>
                        <input
                            type="time"
                            required
                            value={editFormData.startTime}
                            onChange={e => onFormChange({ ...editFormData, startTime: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">終了時間</label>
                        <input
                            type="time"
                            required
                            value={editFormData.endTime}
                            onChange={e => onFormChange({ ...editFormData, endTime: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white"
                        />
                    </div>
                </div>
                
                {editFormData.startTime && editFormData.endTime && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm">
                        <Clock className="w-4 h-4" />
                        <span>
                            {breakSettings?.displayActualHoursInModal ? '実労働時間' : 'シフト時間'}: <span className="font-bold">{actualHours.toFixed(2)}h</span>
                        </span>
                        {breakSettings?.displayActualHoursInModal && breakMins > 0 && (
                            <span className="text-xs opacity-80 ml-auto">
                                (休憩 {breakMins}分差引)
                            </span>
                        )}
                    </div>
                )}

                <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 min-w-0 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        className="flex-1 min-w-0 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4 flex-shrink-0" />
                        <span>保存</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ShiftEditModal;
