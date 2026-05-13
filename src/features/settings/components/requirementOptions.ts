import { SHIFT_DAY } from '../../../constants';

export const dayOfWeekOptions = [
    { value: SHIFT_DAY.WEEKDAYS, label: '平日（月〜金）' },
    { value: 1, label: '月曜日' },
    { value: 2, label: '火曜日' },
    { value: 3, label: '水曜日' },
    { value: 4, label: '木曜日' },
    { value: 5, label: '金曜日' },
    { value: 6, label: '土曜日' },
    { value: 0, label: '日曜日' },
];

export const priorityOptions = [
    { value: 1, label: '低', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700' },
    { value: 2, label: '中低', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' },
    { value: 3, label: '中', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30' },
    { value: 4, label: '中高', color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30' },
    { value: 5, label: '高', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30' },
];
