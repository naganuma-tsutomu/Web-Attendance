import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { getStaffList, deleteStaff, createStaff, updateStaff, getRoles } from '../../lib/api';
import type { Staff, DynamicRole } from '../../types';

const StaffPage = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [roles, setRoles] = useState<DynamicRole[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState<Omit<Staff, 'id'>>({
        name: '',
        role: '',
        hoursTarget: 160,
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [staffData, rolesData] = await Promise.all([
                getStaffList(),
                getRoles()
            ]);
            setStaffList(staffData);
            setRoles(rolesData);

            // Default role for new staff if roles exist
            if (rolesData.length > 0 && !formData.role) {
                setFormData(prev => ({ ...prev, role: rolesData[0].name }));
            }

            setError('');
        } catch (err) {
            console.error("Fetch error", err);
            setError('データの読み込みに失敗しました。設定で役職が登録されているか確認してください。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`${name}さんを削除してもよろしいですか？`)) return;
        try {
            await deleteStaff(id);
            setStaffList(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error(err);
            alert("削除に失敗しました。");
        }
    };

    const handleOpenAddModal = () => {
        setEditingStaff(null);
        setFormData({
            name: '',
            role: roles[0]?.name || '',
            hoursTarget: 160,
            defaultWorkingHoursStart: '',
            defaultWorkingHoursEnd: '',
            isHelpStaff: false
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (staff: Staff) => {
        setEditingStaff(staff);
        setFormData({
            name: staff.name,
            role: staff.role,
            hoursTarget: staff.hoursTarget,
            isHelpStaff: staff.isHelpStaff,
            availableDays: staff.availableDays,
            defaultWorkingHoursStart: staff.defaultWorkingHoursStart,
            defaultWorkingHoursEnd: staff.defaultWorkingHoursEnd,
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingStaff) {
                await updateStaff(editingStaff.id, formData);
            } else {
                await createStaff(formData);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("保存に失敗しました。");
        }
    };

    const filteredStaff = staffList.filter(s => s.name.includes(searchTerm));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">スタッフ管理</h2>
                    <p className="text-slate-500 mt-1">スタッフの登録情報と役職の割り当てを管理します</p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-100 transition-all font-bold"
                >
                    <Plus className="w-5 h-5" />
                    <span>スタッフ追加</span>
                </button>
            </div>

            {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-800 font-medium">{error}</span>
                </div>
            )}

            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="名前で検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm transition-all"
                    />
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    名前
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    役職
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    月間目標時間
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-300" />
                                    </td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                                        該当するスタッフが見つかりません
                                    </td>
                                </tr>
                            ) : (
                                filteredStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-slate-800">{staff.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                {staff.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                                            {staff.hoursTarget} h
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => handleOpenEditModal(staff)}
                                                className="text-slate-400 hover:text-indigo-600 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(staff.id, staff.name)}
                                                className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white">
                        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingStaff ? '情報を更新' : 'スタッフ登録'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400">
                                <Plus className="w-5 h-5 transform rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5 pl-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">氏名</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium text-slate-700"
                                        placeholder="山田 太郎"
                                    />
                                </div>
                                <div className="space-y-1.5 pl-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">役職マスタから選ぶ</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium text-slate-700 appearance-none"
                                    >
                                        {roles.length === 0 && <option value="">役職を登録してください</option>}
                                        {roles.map(role => <option key={role.id} value={role.name}>{role.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5 pl-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">目標労働時間 (h/月)</label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.hoursTarget}
                                        onChange={e => setFormData({ ...formData, hoursTarget: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium text-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <input
                                    type="checkbox"
                                    id="isHelpStaff"
                                    checked={formData.isHelpStaff || false}
                                    onChange={e => setFormData({ ...formData, isHelpStaff: e.target.checked })}
                                    className="rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                />
                                <label htmlFor="isHelpStaff" className="text-sm font-bold text-slate-600 cursor-pointer">ヘルプ要員（不足時の補完に使用）</label>
                            </div>

                            <div className="flex space-x-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 border border-slate-100 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all font-bold uppercase tracking-widest text-xs"
                                >
                                    Confirm & Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffPage;
