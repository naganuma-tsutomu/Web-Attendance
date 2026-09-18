import { handleServerError } from '../../../utils/validation';
import type { Env } from '../../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            `SELECT st.id, st.name, st.role, st.retired_at AS retiredAt,
                    (SELECT COUNT(*) FROM shifts sh WHERE sh.staffId = st.id) AS shiftCount
             FROM staffs st
             WHERE st.retired_at IS NOT NULL
             ORDER BY st.retired_at DESC, st.name ASC`
        ).all();
        return Response.json(results);
    } catch (error) {
        return handleServerError(error, 'Database error fetching retired staff');
    }
};
