import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

/** Miniflare v4形式の簡潔なテスト設定を、v5の実行設定へ変換する。 */
export const createD1Miniflare = (): Miniflare => new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: ['DB'],
}));
