import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_DIR = join(process.cwd(), 'dist');
const ASSET_DIR = join(DIST_DIR, 'assets');
const REQUIRED_ASSET_PREFIXES = ['heavy-excel-', 'exceljs.min-'];

const assets = await readdir(ASSET_DIR);
const serviceWorker = await readFile(join(DIST_DIR, 'sw.js'), 'utf8');
const requiredAssets = REQUIRED_ASSET_PREFIXES.map(prefix => {
    const matches = assets.filter(file => file.startsWith(prefix) && file.endsWith('.js'));
    if (matches.length !== 1) {
        throw new Error(`${prefix}*.js は1件必要ですが、${matches.length}件見つかりました`);
    }
    return matches[0];
});

const missing = requiredAssets.filter(file => !serviceWorker.includes(`assets/${file}`));
if (missing.length > 0) {
    throw new Error(`Excel出力用チャンクがPWAプリキャッシュにありません: ${missing.join(', ')}`);
}

console.log(`PWA precache includes Excel chunks: ${requiredAssets.join(', ')}`);
