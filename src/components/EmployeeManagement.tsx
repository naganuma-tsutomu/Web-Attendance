import React, { useState } from 'react';
import { UserPlus, Trash2, User } from 'lucide-react';
import type { Employee } from '../utils/shiftExport';

interface EmployeeManagementProps {
    employees: Employee[];
    onAddEmployee: (name: string) => void;
    onRemoveEmployee: (id: string) => void;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ employees, onAddEmployee, onRemoveEmployee }) => {
    const [newName, setNewName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim()) {
            onAddEmployee(newName.trim());
            setNewName('');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
                <User className="h-6 w-6 text-indigo-500" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">従業員管理</h2>
            </div>

            {/* Add Employee Form */}
            <form onSubmit={handleSubmit} className="mb-8 flex gap-3">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="新しい従業員名を入力"
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                />
                <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-colors"
                >
                    <UserPlus className="h-4 w-4" />
                    追加
                </button>
            </form>

            {/* Employee List */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">登録済みメンバー ({employees.length}名)</h3>
                {employees.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
                        従業員が登録されていません
                    </div>
                ) : (
                    employees.map((emp) => (
                        <div
                            key={emp.id}
                            className="group flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all shadow-sm"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                    {emp.name.charAt(0)}
                                </div>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{emp.name}</span>
                            </div>
                            <button
                                onClick={() => onRemoveEmployee(emp.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="削除"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default EmployeeManagement;
