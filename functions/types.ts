export interface Env {
    DB: D1Database;
    ADMIN_PASSWORD?: string;
}

/** D1 クエリ結果の行型 */
export type D1Row = Record<string, unknown>;

/** D1 プリペアドステートメントの bind パラメータ型 */
export type D1BindParam = null | number | string | ArrayBuffer;
