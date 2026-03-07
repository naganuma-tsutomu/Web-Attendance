export interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const body = await context.request.json() as any;

        // 渡されたフィールドのみ動的にUPDATEする
        const setClauses: string[] = [];
        const bindings: any[] = [];

        if (body.staffId !== undefined) {
            setClauses.push('staffId = ?');
            bindings.push(body.staffId);
        }
        if (body.startTime !== undefined) {
            setClauses.push('startTime = ?');
            bindings.push(body.startTime);
        }
        if (body.endTime !== undefined) {
            setClauses.push('endTime = ?');
            bindings.push(body.endTime);
        }
        if (body.classType !== undefined) {
            setClauses.push('classType = ?');
            bindings.push(body.classType);
        }
        if (body.isEarlyShift !== undefined) {
            setClauses.push('isEarlyShift = ?');
            bindings.push(body.isEarlyShift ? 1 : 0);
        }
        if (body.isError !== undefined) {
            setClauses.push('isError = ?');
            bindings.push(body.isError ? 1 : 0);
        }

        if (setClauses.length === 0) {
            return new Response('No fields to update', { status: 400 });
        }

        bindings.push(id);
        await context.env.DB.prepare(
            `UPDATE shifts SET ${setClauses.join(', ')} WHERE id = ?`
        ).bind(...bindings).run();

        return new Response('Updated', { status: 200 });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        await context.env.DB.prepare(
            'DELETE FROM shifts WHERE id = ?'
        ).bind(id).run();
        return new Response('Deleted', { status: 200 });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
