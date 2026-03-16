import { handleServerError } from '../../utils/validation';

export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            "SELECT id, name FROM staffs ORDER BY display_order ASC"
        ).all();

        return Response.json(results);
    } catch (e) {
        return handleServerError(e, 'Database error fetching staff list for login');
    }
};
