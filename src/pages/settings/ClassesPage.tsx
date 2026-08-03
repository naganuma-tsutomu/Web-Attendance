import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { getClasses, getStaffList } from '../../lib/api';
import { handleApiError } from '../../lib/errorHandler';
import type { ShiftClass, Staff } from '../../types';
import ClassManagement from '../../features/settings/components/ClassManagement';

const ClassesPage = () => {
    const [classes, setClasses] = useState<ShiftClass[]>([]);
    const [staffs, setStaffs] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [classesData, staffsData] = await Promise.all([
                getClasses(),
                getStaffList()
            ]);
            setClasses(classesData);
            setStaffs(staffsData);
        } catch (err) {
            handleApiError(err, 'クラスデータの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 md:p-8">
                <div className="mb-4 flex items-center space-x-2 sm:mb-6 sm:space-x-3">
                    <GraduationCap className="h-6 w-6 text-indigo-500 sm:h-8 sm:w-8" />
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">クラス管理</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                            クラスの登録と、クラスごとの必要スタッフ数を管理します。
                        </p>
                    </div>
                </div>

                <ClassManagement
                    classes={classes}
                    staffs={staffs}
                    loading={loading}
                    onUpdate={fetchData}
                    setClasses={setClasses}
                />
            </div>
        </div>
    );
};

export default ClassesPage;
