const TOKEN_MAX_AGE_SECONDS = 86400; // 24 hours

// ==========================================
// Access Key utilities
// ==========================================
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 32;

/** 12文字のランダムな16進数アクセスキーを生成する */
export function generateAccessKey(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** アクセスキーをPBKDF2-SHA256でハッシュ化する（salt付き） */
export async function hashAccessKey(plainKey: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(plainKey), 'PBKDF2', false, ['deriveBits']
    );
    const derived = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        PBKDF2_KEYLEN * 8
    );
    const saltB64 = btoa(String.fromCharCode(...Array.from(salt)));
    const hashB64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(derived))));
    return `${saltB64}:${hashB64}`;
}

/** 提供されたキーが保存済みハッシュと一致するか検証する（定数時間比較） */
export async function verifyAccessKey(plainKey: string, storedHash: string): Promise<boolean> {
    const colonIdx = storedHash.indexOf(':');
    if (colonIdx === -1) return false;
    const saltB64 = storedHash.slice(0, colonIdx);
    const hashB64 = storedHash.slice(colonIdx + 1);
    try {
        const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw', encoder.encode(plainKey), 'PBKDF2', false, ['deriveBits']
        );
        const derived = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
            keyMaterial,
            PBKDF2_KEYLEN * 8
        );
        const computedB64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(derived))));
        if (computedB64.length !== hashB64.length) return false;
        let mismatch = 0;
        for (let i = 0; i < computedB64.length; i++) {
            mismatch |= computedB64.charCodeAt(i) ^ hashB64.charCodeAt(i);
        }
        return mismatch === 0;
    } catch {
        return false;
    }
}



async function hmacSign(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// トークン形式: "{iat}:{nonce}.{hmac}"
export async function signCookie(secret: string): Promise<string> {
    const iat = Math.floor(Date.now() / 1000);
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    const payload = `${iat}:${nonce}`;
    const sigHex = await hmacSign(payload, secret);
    return `${payload}.${sigHex}`;
}

export async function verifyCookie(token: string, secret: string): Promise<boolean> {
    const lastDot = token.lastIndexOf('.');
    if (lastDot === -1) return false;

    const payload = token.slice(0, lastDot);
    const sig = token.slice(lastDot + 1);
    if (!payload || !sig) return false;

    // 有効期限チェック
    const colonIdx = payload.indexOf(':');
    if (colonIdx === -1) return false;
    const iat = parseInt(payload.slice(0, colonIdx), 10);
    if (isNaN(iat)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now - iat > TOKEN_MAX_AGE_SECONDS) return false;

    // HMAC検証（タイミング攻撃対策：定数時間比較）
    const expectedSig = await hmacSign(payload, secret);
    const expected = `${payload}.${expectedSig}`;
    if (expected.length !== token.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
        mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return mismatch === 0;
}
