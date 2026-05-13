import React, { useState } from 'react';

interface DutyNumberCellProps {
    shiftId: string;
    value: number;
    isAuto: boolean;
    groupSize: number;
    onUpdate: (shiftId: string, value: number | null) => void;
}

const DutyNumberCell: React.FC<DutyNumberCellProps> = ({ shiftId, value, isAuto, groupSize, onUpdate }) => {
    const [editing, setEditing] = useState(false);
    const options = Array.from({ length: groupSize }, (_, i) => i + 1);

    if (editing) {
        return (
            <div className="hidden sm:flex w-8 flex-shrink-0 border-b sm:border-b-0 border-r border-slate-200 dark:border-slate-700 items-center justify-center">
                <select
                    className="w-full text-[10px] text-center bg-white dark:bg-slate-800 border-0 focus:ring-1 focus:ring-indigo-400 rounded"
                    value={value}
                    onChange={(e) => {
                        onUpdate(shiftId, Number(e.target.value));
                        setEditing(false);
                    }}
                    onBlur={() => setEditing(false)}
                >
                    {options.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            className="hidden sm:flex w-8 flex-shrink-0 border-b sm:border-b-0 border-r border-slate-200 dark:border-slate-700 items-center justify-center gap-0.5 group/duty cursor-pointer"
            title={isAuto ? '自動計算（クリックで変更）' : 'クリックで変更 / 右クリックでリセット'}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditing(true); }}
            onContextMenu={(e) => { e.preventDefault(); onUpdate(shiftId, null); }}
        >
            <span className={`text-xs font-bold ${isAuto ? 'text-slate-400 dark:text-slate-500 italic' : 'text-indigo-600 dark:text-indigo-400'}`}>
                {value}
            </span>
        </div>
    );
};

export default DutyNumberCell;
