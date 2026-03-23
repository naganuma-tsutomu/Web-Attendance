import { createValidationError, handleServerError, validateYearMonth, validateDate, validateTimeRange } from '../../utils/validation';

export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const [y, m] = yearMonth!.split('-').map(Number);
        const startStr = `${yearMonth}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

        const { results } = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE date >= ? AND date < ?"
        ).bind(startStr, nextMonth).all();

        const shifts = results.map((row: any) => ({
            ...row,
            isEarlyShift: row.isEarlyShift === 1,
            isError: row.isError === 1
        }));

        return Response.json(shifts);
    } catch (e) {
        return handleServerError(e, 'GET /shifts');
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const shiftsData: any[] = await context.request.json();
        if (!shiftsData || shiftsData.length === 0) {
            return Response.json({ success: true, message: 'No data to insert' });
        }

        for (let i = 0; i < shiftsData.length; i++) {
            const shift = shiftsData[i];
            const prefix = `shifts[${i}]`;

            const dateError = validateDate(shift.date, `${prefix}.date`);
            if (dateError) return createValidationError(dateError);

            if (!shift.staffId || String(shift.staffId).trim().length === 0) {
                return createValidationError(`${prefix}.staffId は必須です`);
            }

            if (!shift.classType || String(shift.classType).trim().length === 0) {
                return createValidationError(`${prefix}.classType は必須です`);
            }

            const timeError = validateTimeRange(shift.startTime, shift.endTime);
            if (timeError) return createValidationError(`${prefix}: ${timeError}`);
        }

        const stmt = context.env.DB.prepare(
            `INSERT INTO shifts (id, date, staffId, startTime, endTime, classType, isEarlyShift, isError)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );

        // D1 batch limit is 100 statements. Split data into chunks of 100.
        const chunkSize = 100;
        for (let i = 0; i < shiftsData.length; i += chunkSize) {
            const chunk = shiftsData.slice(i, i + chunkSize);
            const batch = chunk.map((shift) => stmt.bind(
                `shift_${crypto.randomUUID()}`,
                shift.date,
                shift.staffId,
                shift.startTime,
                shift.endTime,
                shift.classType,
                shift.isEarlyShift ? 1 : 0,
                shift.isError ? 1 : 0
            ));
            await context.env.DB.batch(batch);
        }

        return Response.json({ success: true, message: `Successfully inserted ${shiftsData.length} shifts` });
    } catch (e) {
        return handleServerError(e, 'POST /shifts');
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const [y, m] = yearMonth!.split('-').map(Number);
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
        await context.env.DB.prepare(
            "DELETE FROM shifts WHERE date >= ? AND date < ?"
        ).bind(`${yearMonth}-01`, nextMonth).run();

        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return handleServerError(e, 'DELETE /shifts');
    }
};
