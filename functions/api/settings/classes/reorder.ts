export interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const { orders }: { orders: { id: string, order: number }[] } = await context.request.json();

        if (!orders || !Array.isArray(orders)) {
            return new Response('Invalid orders data', { status: 400 });
        }

        const statements = orders.map(item =>
            context.env.DB.prepare("UPDATE classes SET display_order = ? WHERE id = ?")
                .bind(item.order, item.id)
        );

        await context.env.DB.batch(statements);

        return new Response('Reordered', { status: 200 });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
