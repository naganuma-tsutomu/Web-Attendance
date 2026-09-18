import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ASSET_DIR = join(process.cwd(), 'dist', 'assets');
const KIB = 1024;
const budgets = {
    javascript: 100 * KIB,
    heavyExcel: 300 * KIB,
    css: 25 * KIB,
};

const files = await readdir(ASSET_DIR);
const measured = await Promise.all(files
    .filter(file => file.endsWith('.js') || file.endsWith('.css'))
    .map(async file => ({
        file,
        gzipBytes: gzipSync(await readFile(join(ASSET_DIR, file))).byteLength,
    })));

const violations = measured.flatMap(({ file, gzipBytes }) => {
    const limit = file.endsWith('.css')
        ? budgets.css
        : file.startsWith('heavy-excel-')
            ? budgets.heavyExcel
            : budgets.javascript;

    return gzipBytes > limit ? [{ file, gzipBytes, limit }] : [];
});

for (const { file, gzipBytes } of measured.sort((a, b) => b.gzipBytes - a.gzipBytes).slice(0, 8)) {
    console.log(`${file}: ${(gzipBytes / KIB).toFixed(1)} KiB gzip`);
}

if (violations.length > 0) {
    console.error('\nBundle size budget exceeded:');
    for (const { file, gzipBytes, limit } of violations) {
        console.error(`- ${file}: ${(gzipBytes / KIB).toFixed(1)} KiB > ${(limit / KIB).toFixed(1)} KiB`);
    }
    process.exitCode = 1;
}
