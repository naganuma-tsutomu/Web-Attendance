/**
 * Cloudflare Pages Functions の型定義。
 * @cloudflare/workers-types を直接依存させず自前で定義することで、
 * 特定のランタイムバージョンへの固定、CIの軽量化、およびプロジェクト固有の型拡張を容易にしています。
 */
type PagesFunction<
    Env = unknown,
    Params extends string = string,
    Data extends Record<string, unknown> = Record<string, unknown>
> = (context: EventContext<Env, Params, Data>) => Response | Promise<Response>;

interface EventContext<
    Env = unknown,
    Params extends string = string,
    Data extends Record<string, unknown> = Record<string, unknown>
> {
    request: Request;
    env: Env;
    params: Record<Params, string>;
    data: Data;
    next: () => Promise<Response>;
    waitUntil: (promise: Promise<unknown>) => void;
}

interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
    dump(): Promise<ArrayBuffer>;
}

interface D1PreparedStatement {
    bind(...values: D1BindValue[]): D1PreparedStatement;
    first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
    run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    raw<T = unknown[]>(): Promise<T[]>;
}

type D1BindValue = string | number | null | ArrayBuffer | boolean;

interface D1Result<T = Record<string, unknown>> {
    results: T[];
    success: boolean;
    meta: Record<string, unknown>;
    error?: string;
}

interface D1ExecResult {
    count: number;
    duration: number;
}
