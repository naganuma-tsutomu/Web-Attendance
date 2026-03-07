import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Loader2, CheckCircle, Settings2, Moon, Sun, Users, GripVertical } from 'lucide-react';
import {
    getTimePatterns, createTimePattern, deleteTimePattern,
    getRoles, createRole, deleteRole, updateRolePatterns, updateRole,
    getClasses, createClass, deleteClass, updateClassOrder, updateClass
} from '../../lib/api';
import type { ShiftTimePattern, DynamicRole, ShiftClass } from '../../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

const SortableClassRow = ({ cls, onDelete, children }: {
    cls: ShiftClass,
    onDelete: (id: string) => void,
    children: React.ReactNode
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: cls.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all ${isDragging ? 'bg-indigo-50/50 outline-2 outline-indigo-200 outline-dashed' : ''}`}
        >
            <div className="flex items-center space-x-4">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 p-1 rounded-lg hover:bg-white transition-all"
                >
                    <GripVertical className="w-5 h-5" />
                </button>
                {children}
            </div>
            <div className="flex items-center space-x-2">
                <button onClick={() => onDelete(cls.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const SettingsPage = () => {
    // State for Time Patterns
    const [timePatterns, setTimePatterns] = useState<ShiftTimePattern[]>([]);
    const [loadingPatterns, setLoadingPatterns] = useState(true);
    const [newPattern, setNewPattern] = useState({ name: '', startTime: '09:00', endTime: '18:00' });

    // State for Roles
    const [roles, setRoles] = useState<DynamicRole[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [newRole, setNewRole] = useState<{
        name: string;
        hoursTarget: number | null;
        patternIds: string[];
    }>({
        name: '',
        hoursTarget: null,
        patternIds: []
    });

    // State for Classes
    const [classes, setClasses] = useState<ShiftClass[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [newClass, setNewClass] = useState({ name: '', auto_allocate: 1 });

    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'patterns' | 'roles' | 'classes' | 'appearance'>('patterns');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    });
    const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => {
        return (parseInt(localStorage.getItem('weekStartsOn') || '0') as 0 | 1);
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('weekStartsOn', weekStartsOn.toString());
    }, [weekStartsOn]);

    const fetchData = async () => {
        setLoadingPatterns(true);
        setLoadingRoles(true);
        setLoadingClasses(true);
        try {
            const [patternsData, rolesData, classesData] = await Promise.all([
                getTimePatterns(),
                getRoles(),
                getClasses()
            ]);
            setTimePatterns(patternsData);
            setRoles(rolesData);
            setClasses(classesData);
        } catch (err) {
            console.error('Failed to load settings', err);
        } finally {
            setLoadingPatterns(false);
            setLoadingRoles(false);
            setLoadingClasses(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const showMessage = (msg: string) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    // --- Time Pattern Handlers ---
    const handleAddPattern = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createTimePattern(newPattern);
            setNewPattern({ name: '', startTime: '09:00', endTime: '18:00' });
            showMessage('パターンを追加しました');
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleDeletePattern = async (id: string) => {
        if (!confirm('このパターンを削除しますか？')) return;
        try {
            await deleteTimePattern(id);
            fetchData();
        } catch (err) { console.error(err); }
    };

    // --- Role Handlers ---
    const handleAddRole = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createRole(newRole.name, newRole.hoursTarget, newRole.patternIds);
            setNewRole({ name: '', hoursTarget: null, patternIds: [] });
            showMessage('役職を追加しました');
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleUpdateRoleHours = async (roleId: string, hours: number | null) => {
        try {
            await updateRole(roleId, { targetHours: hours });
            setRoles(prev => prev.map(r => r.id === roleId ? { ...r, targetHours: hours } : r));
            showMessage('目標時間を更新しました');
        } catch (err) { console.error(err); }
    };

    const handleDeleteRole = async (id: string) => {
        if (!confirm('この役職を削除しますか？スタッフの割り当ては解除されませんが、新規選択はできなくなります。')) return;
        try {
            await deleteRole(id);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleTogglePattern = async (roleId: string, patternId: string, currentPatterns: ShiftTimePattern[]) => {
        const isAssigned = currentPatterns.some(p => p.id === patternId);
        const newPatternIds = isAssigned
            ? currentPatterns.filter(p => p.id !== patternId).map(p => p.id)
            : [...currentPatterns.map(p => p.id), patternId];

        try {
            await updateRolePatterns(roleId, newPatternIds);
            // Local update for UI responsiveness
            setRoles(prev => prev.map(r => r.id === roleId ? {
                ...r,
                patterns: isAssigned
                    ? r.patterns.filter(p => p.id !== patternId)
                    : [...r.patterns, timePatterns.find(tp => tp.id === patternId)!]
            } : r));
        } catch (err) { console.error(err); }
    };

    // --- Class Handlers ---
    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClass.name.trim()) return;
        try {
            await createClass(newClass.name, newClass.auto_allocate);
            setNewClass({ name: '', auto_allocate: 1 });
            showMessage('クラスを追加しました');
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleToggleClassAllocation = async (cls: ShiftClass) => {
        const newValue = cls.auto_allocate === 1 ? 0 : 1;
        try {
            await updateClass(cls.id, { auto_allocate: newValue });
            setClasses(prev => prev.map(c => c.id === cls.id ? { ...c, auto_allocate: newValue } : c));
            showMessage('設定を更新しました');
        } catch (err) { console.error(err); }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm('このクラスを削除しますか？')) return;
        try {
            await deleteClass(id);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleClassDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = classes.findIndex(c => c.id === active.id);
        const newIndex = classes.findIndex(c => c.id === over.id);

        const newClasses = arrayMove(classes, oldIndex, newIndex);
        setClasses(newClasses);

        try {
            const orders = newClasses.map((c, index) => ({
                id: c.id,
                order: index
            }));
            await updateClassOrder(orders);
        } catch (err) {
            console.error('Failed to update class order', err);
            // Rollback on error
            fetchData();
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 p-4 sm:p-6 md:p-8">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                    <Settings2 className="w-7 h-7 text-indigo-500" />
                    <span>設定</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">勤務時間の種類と、役職ごとの利用可能パターンを定義します。</p>
            </div>

            {message && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{message}</span>
                </div>
            )}

            {/* Tab navigation */}
            <div className="flex space-x-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('patterns')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'patterns' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    勤務時間パターン
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'roles' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    役職管理
                </button>
                <button
                    onClick={() => setActiveTab('classes')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'classes' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    クラス管理
                </button>
                <button
                    onClick={() => setActiveTab('appearance')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'appearance' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    外観設定
                </button>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {activeTab === 'patterns' ? (
                    <div className="space-y-6">
                        {/* Pattern form */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center space-x-2">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                <span>パターンの新規作成</span>
                            </h3>
                            <form onSubmit={handleAddPattern} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">パターン名 (必須)</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="例: 早番"
                                        value={newPattern.name}
                                        onChange={e => setNewPattern({ ...newPattern, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">開始時間</label>
                                    <input
                                        type="time"
                                        required
                                        value={newPattern.startTime}
                                        onChange={e => setNewPattern({ ...newPattern, startTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">終了時間</label>
                                    <input
                                        type="time"
                                        required
                                        value={newPattern.endTime}
                                        onChange={e => setNewPattern({ ...newPattern, endTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                                    />
                                </div>
                                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all h-[38px] flex items-center justify-center space-x-2">
                                    <Plus className="w-4 h-4" />
                                    <span>追加</span>
                                </button>
                            </form>
                        </div>

                        {/* Patterns list */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300">パターン一覧</h3>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {loadingPatterns ? (
                                    <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                                ) : timePatterns.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">パターンが登録されていません。</div>
                                ) : (
                                    timePatterns.map(p => (
                                        <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold">
                                                    {p.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{p.startTime} 〜 {p.endTime}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleDeletePattern(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'roles' ? (
                    <div className="space-y-6">
                        {/* Role form */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-6">役職の新規登録</h3>
                            <form onSubmit={handleAddRole} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">役職名</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="例: パートB"
                                            value={newRole.name}
                                            onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between pl-1">
                                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">月間労働時間</label>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] font-bold text-slate-500">{newRole.hoursTarget === null ? '制限なし' : '設定する'}</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={newRole.hoursTarget !== null}
                                                        onChange={(e) => {
                                                            setNewRole({ ...newRole, hoursTarget: e.target.checked ? 160 : null });
                                                        }}
                                                    />
                                                    <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="number"
                                                value={newRole.hoursTarget === null ? '' : newRole.hoursTarget}
                                                disabled={newRole.hoursTarget === null}
                                                onChange={e => setNewRole({ ...newRole, hoursTarget: parseInt(e.target.value) || 0 })}
                                                placeholder="設定なし"
                                                className={`flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold ${newRole.hoursTarget === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white'}`}
                                            />
                                            <span className="text-xs text-slate-500 font-bold">時間</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">利用可能な時間パターン (複数選択可)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {timePatterns.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic px-1">まずは勤務パターンを登録してください</p>
                                        ) : (
                                            timePatterns.map(p => {
                                                const isSelected = newRole.patternIds.includes(p.id);
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const nextIds = isSelected
                                                                ? newRole.patternIds.filter(id => id !== p.id)
                                                                : [...newRole.patternIds, p.id];
                                                            setNewRole({ ...newRole, patternIds: nextIds });
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1.5 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                                    >
                                                        {isSelected && <CheckCircle className="w-3 h-3" />}
                                                        <span>{p.name}</span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center space-x-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>役職を登録する</span>
                                    </button>
                                </div>
                            </form>
                        </div>

                        {loadingRoles ? (
                            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {roles.map(role => (
                                    <div key={role.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                                                <h4 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight">{role.name}</h4>
                                            </div>
                                            <button onClick={() => handleDeleteRole(role.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-5 flex-1 space-y-4">
                                            <div className="flex items-center justify-between pl-1 mb-1.5">
                                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">月間労働時間</label>
                                                <div className="flex items-center space-x-2 scale-75 origin-right">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={role.targetHours !== null}
                                                            onChange={(e) => {
                                                                const newHours = e.target.checked ? 160 : null;
                                                                handleUpdateRoleHours(role.id, newHours);
                                                            }}
                                                        />
                                                        <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="number"
                                                    value={role.targetHours ?? ''}
                                                    disabled={role.targetHours === null}
                                                    onChange={(e) => handleUpdateRoleHours(role.id, parseInt(e.target.value) || 0)}
                                                    placeholder="設定なし"
                                                    className={`w-24 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold transition-all ${role.targetHours === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white'}`}
                                                />
                                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">時間</span>
                                            </div>

                                            <div>
                                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-widest pl-1">可用パターン</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {timePatterns.length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic">まずはパターンを作成してください</p>
                                                    ) : (
                                                        timePatterns.map(p => {
                                                            const isAssigned = role.patterns.some(rp => rp.id === p.id);
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => handleTogglePattern(role.id, p.id, role.patterns)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1.5 ${isAssigned ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500'}`}
                                                                >
                                                                    {isAssigned && <CheckCircle className="w-3 h-3" />}
                                                                    <span>{p.name} ({p.startTime})</span>
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'classes' ? (
                    <div className="space-y-6">
                        {/* Class form */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center space-x-2">
                                <Users className="w-5 h-5 text-indigo-400" />
                                <span>クラスの新規作成</span>
                            </h3>
                            <form onSubmit={handleAddClass} className="space-y-4">
                                <div className="flex gap-4 items-end">
                                    <div className="space-y-1 flex-1">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">クラス名 (必須)</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="例: ひまわり組"
                                            value={newClass.name}
                                            onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                                        />
                                    </div>
                                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all h-[38px] flex items-center justify-center space-x-2">
                                        <Plus className="w-4 h-4" />
                                        <span>追加</span>
                                    </button>
                                </div>
                                <div className="flex items-center space-x-2 pl-1">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={newClass.auto_allocate === 1}
                                            onChange={(e) => setNewClass({ ...newClass, auto_allocate: e.target.checked ? 1 : 0 })}
                                        />
                                        <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                    </label>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">このクラスを自動シフト作成の対象にする</span>
                                </div>
                            </form>
                        </div>

                        {/* Classes list */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300">クラス一覧</h3>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {loadingClasses ? (
                                    <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                                ) : classes.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">クラスが登録されていません。</div>
                                ) : (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleClassDragEnd}
                                        modifiers={[restrictToVerticalAxis]}
                                    >
                                        <SortableContext
                                            items={classes.map(c => c.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {classes.map(c => (
                                                <SortableClassRow
                                                    key={c.id}
                                                    cls={c}
                                                    onDelete={handleDeleteClass}
                                                >
                                                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold">
                                                        {c.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 dark:text-slate-100">{c.name}</p>
                                                        <div className="flex items-center space-x-2 mt-1">
                                                            <label className="relative inline-flex items-center cursor-pointer scale-75 origin-left">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={c.auto_allocate === 1}
                                                                    onChange={() => handleToggleClassAllocation(c)}
                                                                />
                                                                <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                                            </label>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">自動割り当て: {c.auto_allocate === 1 ? '有効' : '無効'}</span>
                                                        </div>
                                                    </div>
                                                </SortableClassRow>
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center space-x-2">
                            <Moon className="w-5 h-5 text-indigo-500" />
                            <span>外観設定</span>
                        </h3>

                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">カラーテーマ</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">アプリ全体の配色を切り替えます。</p>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        <Sun className="w-4 h-4" />
                                        <span>ライト</span>
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'dark' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        <Moon className="w-4 h-4" />
                                        <span>ダーク</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">週の開始日</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">カレンダーの表示を開始する曜日を選択します。</p>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                    <button
                                        onClick={() => setWeekStartsOn(0)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekStartsOn === 0 ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        日曜日
                                    </button>
                                    <button
                                        onClick={() => setWeekStartsOn(1)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekStartsOn === 1 ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        月曜日
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                                    ※ 現時点ではダークモードは一部の画面で正しく表示されない場合があります。順次対応中です。
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
