import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, AlertCircle } from 'lucide-react';
import { getStaffList, deleteStaff, createStaff, updateStaff } from '../../lib/api';
import type { Staff, Role } from '../../types';

const ROLES: Role[] = ['正社員', '準社員', 'パート', '特殊スタッフ'];

const StaffPage = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState<Omit<Staff, 'id'>>({
        name: '',
        role: '正社員',
        hoursTarget: 160,
    });

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const data = await getStaffList();
            setStaffList(data);
            setError('');
        } catch (err) {
            console.error("Fetch error", err);
            setError('データベースからの読み込みに失敗しました。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
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
        setFormData({ name: '', role: '正社員', hoursTarget: 160 });
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
            defaultWorkingHours: staff.defaultWorkingHours,
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
            fetchStaff();
        } catch (err) {
            console.error(err);
            alert("保存に失敗しました。");
        }
    };

    const filteredStaff = staffList.filter(s => s.name.includes(searchTerm));

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">スタッフ管理</h2>
                    <p className="text-slate-500 mt-1">全スタッフの登録情報と勤務条件を管理します</p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl shadow-sm transition-colors w-full sm:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    <span>スタッフ追加</span>
                </button>
            </div>

            {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-800">{error}</span>
                </div>
            )}

            {/* Filters and Search Area */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="名前で検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-slate-50"
                    />
                </div>
                <div className="flex space-x-2">
                    <button className="flex items-center space-x-2 px-4 py-2.5 border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors bg-white">
                        <Filter className="w-5 h-5 text-slate-500" />
                        <span>絞り込み</span>
                    </button>
                </div>
            </div>

            {/* Staff List Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    名前
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    雇用形態
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    目標労働時間 (月)
                                </th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    アクション
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        読み込み中...
                                    </td>
                                </tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        スタッフが見つかりません。
                                    </td>
                                </tr>
                            ) : (
                                filteredStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-slate-900">{staff.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                      ${staff.role === '正社員' ? 'bg-blue-100 text-blue-800' : ''}
                      ${staff.role === '準社員' ? 'bg-indigo-100 text-indigo-800' : ''}
                      ${staff.role === 'パート' ? 'bg-emerald-100 text-emerald-800' : ''}
                      ${staff.role === '特殊スタッフ' ? 'bg-amber-100 text-amber-800' : ''}
                    `}>
                                                {staff.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {staff.hoursTarget} 時間
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                            <button
                                                onClick={() => handleOpenEditModal(staff)}
                                                className="text-indigo-600 hover:text-indigo-900 transition-colors p-1 rounded-lg hover:bg-indigo-50"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(staff.id, staff.name)}
                                                className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-lg hover:bg-red-50"
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

            {/* Staff Edit/Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingStaff ? 'スタッフ情報を編集' : '新しくスタッフを追加'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <Plus className="w-6 h-6 transform rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">名前</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">雇用形態</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                                >
                                    {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">月間目標労働時間 (h)</label>
                                <input
                                    type="number"
                                    required
                                    value={formData.hoursTarget}
                                    onChange={e => setFormData({ ...formData, hoursTarget: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                                />
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isHelpStaff"
                                    checked={formData.isHelpStaff || false}
                                    onChange={e => setFormData({ ...formData, isHelpStaff: e.target.checked })}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                <label htmlFor="isHelpStaff" className="text-sm text-slate-700">ヘルプ要員として扱う（シフト不足時に補完）</label>
                            </div>

                            <div className="flex space-x-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-colors font-medium"
                                >
                                    保存する
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
