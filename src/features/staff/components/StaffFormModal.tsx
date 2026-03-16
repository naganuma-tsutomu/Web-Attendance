import React from 'react';
import { Plus, CheckCircle, Loader2 } from 'lucide-react';
import type { Staff, DynamicRole, ShiftClass } from '../../../types';

interface StaffFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    editingStaff: Staff | null;
    formData: Omit<Staff, 'id'> | Staff;
    setFormData: React.Dispatch<React.SetStateAction<any>>;
    roles: DynamicRole[];
    classes: ShiftClass[];
    isSubmitting: boolean;
    handleRoleChange: (roleName: string) => void;
}

const StaffFormModal = ({
    isOpen,
    onClose,
    onSubmit,
    editingStaff,
    formData,
    setFormData,
    roles,
    classes,
    isSubmitting,
    handleRoleChange
}: StaffFormModalProps) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md max-h-[85dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
                <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/30">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                        {editingStaff ? '情報を更新' : 'スタッフ登録'}
                    </h3>
                    <button onClick={onClose} className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                        <Plus className="w-5 h-5 transform rotate-45" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-8 space-y-6 overflow-y-auto flex-1">
                    <div className="space-y-4">
                        <div className="space-y-1.5 pl-1">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">氏名</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white"
                                placeholder="山田 太郎"
                            />
                        </div>
                        <div className="space-y-1.5 pl-1">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">役職マスタから選ぶ</label>
                            <select
                                value={formData.role}
                                onChange={e => handleRoleChange(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white appearance-none"
                            >
                                {roles.length === 0 && <option value="">役職を登録してください</option>}
                                {roles.map(role => <option key={role.id} value={role.name}>{role.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5 pl-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">アクセスキー (4桁の数字)</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, accessKey: Math.floor(1000 + Math.random() * 9000).toString() })}
                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    自動生成
                                </button>
                            </div>
                            <input
                                type="text"
                                required
                                maxLength={4}
                                pattern="\d{4}"
                                value={formData.accessKey || ''}
                                onChange={e => setFormData({ ...formData, accessKey: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                className="w-full px-4 py-3 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-mono font-bold tracking-widest text-slate-700 dark:text-white"
                                placeholder="1234"
                            />
                        </div>
                        <div className="space-y-3 pl-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">月間労働時間 (h/月)</label>
                                <div className="flex items-center space-x-2">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{formData.hoursTarget === null ? '設定なし' : '設定する'}</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.hoursTarget !== null}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setFormData({ ...formData, hoursTarget: checked ? 160 : null });
                                            }}
                                        />
                                        <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>
                            <input
                                type="number"
                                required
                                value={formData.hoursTarget === null ? '' : formData.hoursTarget}
                                disabled={formData.hoursTarget === null}
                                onChange={e => setFormData({ ...formData, hoursTarget: parseInt(e.target.value) || 0 })}
                                placeholder="設定されていません"
                                className={`w-full px-4 py-3 border rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium transition-all
                                    ${formData.hoursTarget === null
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white'
                                    }`}
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">固定休日設定</label>
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 space-y-4">
                            {['月', '火', '水', '木', '金', '土'].map((label, idx) => {
                                const dayNum = idx + 1;
                                const config = formData.availableDays?.find((d: any) =>
                                    d && (typeof d === 'number' ? d : d.day) === dayNum
                                );
                                const isPartialWorking = typeof config === 'object' && Array.isArray((config as any).weeks);
                                const isHolidayEveryWeek = !config;
                                const isHoliday = isHolidayEveryWeek || isPartialWorking;

                                return (
                                    <div key={dayNum} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-8">{label}曜</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={isHoliday}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            let newAvailableDays = [...(formData.availableDays || [1, 2, 3, 4, 5, 6])];
                                                            if (checked) {
                                                                newAvailableDays = newAvailableDays.filter(d => (typeof d === 'number' ? d : d.day) !== dayNum);
                                                            } else {
                                                                newAvailableDays = newAvailableDays.filter(d => (typeof d === 'number' ? d : d.day) !== dayNum);
                                                                newAvailableDays.push(dayNum);
                                                            }
                                                            setFormData({ ...formData, availableDays: newAvailableDays });
                                                        }}
                                                    />
                                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 dark:peer-checked:bg-red-600"></div>
                                                    <span className="ms-3 text-xs font-bold text-slate-500 dark:text-slate-400">{isHoliday ? '休み' : '出勤'}</span>
                                                </label>
                                            </div>

                                            {isHoliday && (
                                                <div className="flex space-x-1">
                                                    {[1, 2, 3, 4, 5].map(week => {
                                                        let isWeekHoliday = false;
                                                        if (isHolidayEveryWeek) {
                                                            isWeekHoliday = true;
                                                        } else if (isPartialWorking) {
                                                            const weeksAvailable = (config as any).weeks || [];
                                                            isWeekHoliday = !weeksAvailable.includes(week);
                                                        }

                                                        return (
                                                            <button
                                                                key={week}
                                                                type="button"
                                                                onClick={() => {
                                                                    let newAvailableDays = [...(formData.availableDays || [1, 2, 3, 4, 5, 6])];
                                                                    const currentConfig = newAvailableDays.find(d => d && (typeof d === 'number' ? d : d.day) === dayNum);
                                                                    let availableWeeks = [1, 2, 3, 4, 5];
                                                                    if (typeof currentConfig === 'object') {
                                                                        availableWeeks = [...(currentConfig.weeks || [])];
                                                                    } else if (!currentConfig) {
                                                                        availableWeeks = [];
                                                                    }
                                                                    if (isWeekHoliday) {
                                                                        availableWeeks.push(week);
                                                                    } else {
                                                                        availableWeeks = availableWeeks.filter(w => w !== week);
                                                                    }
                                                                    availableWeeks.sort();
                                                                    newAvailableDays = newAvailableDays.filter(d => (typeof d === 'number' ? d : d.day) !== dayNum);
                                                                    if (availableWeeks.length === 5) {
                                                                        newAvailableDays.push(dayNum);
                                                                    } else if (availableWeeks.length > 0) {
                                                                        newAvailableDays.push({ day: dayNum, weeks: availableWeeks });
                                                                    }
                                                                    setFormData({ ...formData, availableDays: newAvailableDays });
                                                                }}
                                                                className={`w-7 h-7 rounded-lg text-[10px] font-bold border transition-all ${isWeekHoliday
                                                                    ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 shadow-sm'
                                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                                                    }`}
                                                                title={`第${week}週`}
                                                            >
                                                                {week}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 italic">※ 数字ボタンが赤色の週が休みになります。クリックして切り替えられます。</p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">所属クラス（複数選択可）</label>
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                            {classes.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">クラスが登録されていません。設定画面で作成してください。</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {classes.map(cls => {
                                        const isSelected = formData.classIds?.includes(cls.id);
                                        return (
                                            <button
                                                key={cls.id}
                                                type="button"
                                                onClick={() => {
                                                    const currentIds = formData.classIds || [];
                                                    const nextIds = isSelected
                                                        ? currentIds.filter(id => id !== cls.id)
                                                        : [...currentIds, cls.id];
                                                    setFormData({ ...formData, classIds: nextIds });
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5
                                                    ${isSelected
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                                                    }`}
                                            >
                                                {isSelected && <CheckCircle className="w-3 h-3" />}
                                                <span>{cls.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 italic">※ 自動シフト作成時、選択されたクラスの中からランダムに割り当てられます。</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <input
                            type="checkbox"
                            id="isHelpStaff"
                            checked={formData.isHelpStaff || false}
                            onChange={e => setFormData({ ...formData, isHelpStaff: e.target.checked })}
                            className="rounded-lg border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 h-5 w-5 bg-white dark:bg-slate-800"
                        />
                        <label htmlFor="isHelpStaff" className="text-sm font-bold text-slate-600 dark:text-slate-400 cursor-pointer">ヘルプ要員（不足時の補完に使用）</label>
                    </div>

                    <div className="flex space-x-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>Confirm & Save</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StaffFormModal;
