/**
 * 祝日判定ユーティリティ
 * 日本の祝日（固定祝日）の判定を行う
 */

/**
 * 固定祝日のリスト
 *  месяцと日で指定（例：1月1日）
 */
export interface Holiday {
    month: number;
    day: number;
    name: string;
}

export const FIXED_HOLIDAYS: Holiday[] = [
    { month: 1, day: 1, name: '元日' },
    { month: 1, day: 2, name: '事始' }, // 1948年〜1966年
    { month: 1, day: 3, name: '事始' }, // 1948年〜1966年
    { month: 1, day: 15, name: '成人の日' }, // 第2月曜日へ移行前的
    { month: 2, day: 11, name: '建国記念の日' },
    { month: 2, day: 12, name: '皇太子誕生日' }, // 1967年〜1988年
    { month: 2, day: 23, name: '天皇誕生日' }, // 2020年〜現在
    { month: 2, day: 24, name: '天皇誕生日' }, // 2019年
    { month: 3, day: 20, name: '春分の日' },
    { month: 3, day: 21, name: '春分の日' },
    { month: 4, day: 10, name: '皇后誕生日' }, // 1967年〜1972年
    { month: 4, day: 29, name: '昭和の日' }, // 2007年〜現在
    { month: 4, day: 29, name: '天皇誕生日' }, // 1948年〜1988年
    { month: 4, day: 29, name: 'みどりの日' }, // 1989年〜2006年
    { month: 5, day: 3, name: '憲法記念日' },
    { month: 5, day: 4, name: 'みどりの日' }, // 2007年〜現在
    { month: 5, day: 4, name: '休日' }, // 1988年〜2006年
    { month: 5, day: 5, name: 'こどもの日' },
    { month: 7, day: 20, name: '海の日' }, // 2020年〜現在（、体育の日は第2月曜日）
    { month: 7, day: 23, name: '海の日' }, // 2020年（东京奥运延期）
    { month: 7, day: 24, name: 'スポーツの日' }, // 2020年（东京奥运延期）
    { month: 8, day: 10, name: '山の日' }, // 2020年〜現在
    { month: 8, day: 6, name: '原爆投下日' }, // 地方自治纪念日
    { month: 8, day: 9, name: '原爆投下日' }, // 地方自治纪念日
    { month: 9, day: 15, name: '敬老の日' }, // 第3月曜日へ移行前的
    { month: 9, day: 21, name: '秋分の日' },
    { month: 9, day: 22, name: '秋分の日' },
    { month: 10, day: 10, name: '体育の日' }, // 第2月曜日へ移行前的
    { month: 11, day: 3, name: '文化の日' },
    { month: 11, day: 23, name: '勤労感謝の日' },
    { month: 12, day: 23, name: '天皇誕生日' }, // 1989年〜2018年
];

/**
 * 祝日の判定
 * @param date 判定する日付
 * @returns 祝日の場合は祝日の名前、そうでない場合はnull
 */
export function getHolidayName(date: Date): string | null {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const holiday = FIXED_HOLIDAYS.find(h => h.month === month && h.day === day);
    return holiday ? holiday.name : null;
}

/**
 * 対象の日付が日曜日かどうか判定
 * @param date 判定する日付
 * @returns 日曜日の場合はtrue
 */
export function isSunday(date: Date): boolean {
    return date.getDay() === 0;
}

/**
 * 対象の日付が土曜日かどうか判定
 * @param date 判定する日付
 * @returns 土曜日の場合はtrue
 */
export function isSaturday(date: Date): boolean {
    return date.getDay() === 6;
}

/**
 * 対象の日が平日（月〜金）かどうか判定
 * @param date 判定する日付
 * @returns 平日（月〜金）の場合はtrue
 */
export function isWeekday(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 5;
}

/**
 * 対象の日が祝祭日（日曜日、土曜日、祝日）かどうか判定
 * @param date 判定する日付
 * @returns 祝祭日の場合はtrue
 */
export function isHoliday(date: Date): boolean {
    return isSunday(date) || isSaturday(date) || getHolidayName(date) !== null;
}

/**
 * 対象の日が稼働日（祝祭日以外）かどうか判定
 * @param date 判定する日付
 * @returns 稼働日の場合はtrue
 */
export function isWorkingDay(date: Date): boolean {
    return !isHoliday(date);
}

/**
 * 特定の年月における春分の日または秋分の日の近似値を計算
 * 正確には国立天文台発表の計算式が必要だが、ここでは簡易的な近似を提供
 * @param year 年
 * @param type 'spring' | 'autumn'
 * @returns  приблизительная 日付
 */
export function getEquinoxDay(year: number, type: 'spring' | 'autumn'): Date {
    // 簡易的な計算式（国立天文台発表の値を 기반으로しています）
    if (type === 'spring') {
        // 春分の日（2000年以降）
        // 計算式: 20.8887 + 0.2424 * (year - 2000) - floor((year - 2000) / 4)
        const day = Math.floor(20.8887 + 0.2424 * (year - 2000) - Math.floor((year - 2000) / 4));
        return new Date(year, 2, day);
    } else {
        // 秋分の日（2000年以降）
        // 計算式: 23.2488 + 0.2424 * (year - 2000) - floor((year - 2000) / 4)
        const day = Math.floor(23.2488 + 0.2424 * (year - 2000) - Math.floor((year - 2000) / 4));
        return new Date(year, 8, day);
    }
}

/**
 * 与えられた日付範囲内の祝祭日（日曜日、土曜日、祝日）のリストを取得
 * @param startDate 開始日
 * @param endDate 終了日
 * @returns 祝祭日の配列
 */
export function getHolidaysInRange(startDate: Date, endDate: Date): Date[] {
    const holidays: Date[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
        if (isHoliday(current)) {
            holidays.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
    }
    
    return holidays;
}

/**
 * 与えられた年月において、第n曜日の日付を取得
 * @param year 年
 * @param month 月（0-indexed）
 * @param dayOfWeek 曜日（0: 日曜日、1: 月曜日、...、6: 土曜日）
 * @param n 何番目の曜日か（1: 第1月曜日、2: 第2月曜日、...、-1: 最終月曜日）
 * @returns 日付
 */
export function getNthWeekdayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date | null {
    const lastDay = new Date(year, month + 1, 0);
    
    // 第n週目の場合
    if (n > 0) {
        let count = 0;
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(year, month, d);
            if (date.getDay() === dayOfWeek) {
                count++;
                if (count === n) {
                    return date;
                }
            }
        }
        return null;
    }
    
    // 最後の場合
    if (n === -1) {
        for (let d = lastDay.getDate(); d >= 1; d--) {
            const date = new Date(year, month, d);
            if (date.getDay() === dayOfWeek) {
                return date;
            }
        }
        return null;
    }
    
    return null;
}
