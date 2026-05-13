import React from 'react';
import { Lock, Unlock } from 'lucide-react';

interface TimelineFixedToggleProps {
    isFixed: boolean;
    onToggleFixed: () => void;
}

export const TimelineFixedToggle = ({ isFixed, onToggleFixed }: TimelineFixedToggleProps) => (
    <div className="flex justify-end p-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <button
            onClick={onToggleFixed}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border shadow-sm ${
                isFixed
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
        >
            {isFixed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{isFixed ? '自動生成からロック中' : 'シフトをロックする'}</span>
        </button>
    </div>
);

interface TimelineHeaderRowsProps {
    readOnly: boolean;
    showDutyNumbers: boolean;
    hourLabels: number[];
    displayStartMins: number;
    displayTotalMins: number;
}

export const TimelineHeaderRows = ({
    readOnly,
    showDutyNumbers,
    hourLabels,
    displayStartMins,
    displayTotalMins,
}: TimelineHeaderRowsProps) => {
    if (readOnly) {
        return (
            <div className="flex bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/50 text-[10px] font-bold text-slate-500 sticky top-0 z-10">
                <div className="w-[110px] sm:w-44 flex-shrink-0 p-1.5 border-r border-slate-200 dark:border-slate-700 text-center flex flex-col justify-center leading-tight"><span>名前</span><span className="hidden sm:inline"> / 時間</span></div>
                <div className="flex-1 relative h-6">
                    {hourLabels.map((h) => {
                        const leftPct = ((h * 60 - displayStartMins) / displayTotalMins) * 100;
                        return (
                            <div key={h} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[9px] text-slate-400" style={{ left: `${leftPct}%` }}>{h}</div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 sticky top-0 z-20">
            <div className={`hidden sm:flex ${showDutyNumbers ? 'w-[512px]' : 'w-[480px]'} flex-shrink-0`}>
                {showDutyNumbers && (
                    <div className="w-8 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">№</div>
                )}
                <div className="w-28 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">名前</div>
                <div className="w-36 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">シフトパターン</div>
                <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">開始</div>
                <div className="w-20 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">終了</div>
                <div className="w-14 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">時間</div>
            </div>
            <div className="sm:hidden w-[110px] flex-shrink-0 p-2 border-r border-slate-300 dark:border-slate-600 flex items-center justify-center">スタッフ</div>
            <div className="flex-1 relative h-8 border-l border-slate-300 dark:border-slate-600">
                {hourLabels.map((h) => {
                    const leftPct = ((h * 60 - displayStartMins) / displayTotalMins) * 100;
                    return (
                        <React.Fragment key={h}>
                            <div className="absolute top-0 bottom-0 border-l border-slate-300/50 dark:border-slate-600/50" style={{ left: `${leftPct}%` }} />
                            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-0.5 z-10" style={{ left: `${leftPct}%` }}>{h}</div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};
