const TOKEN_MAX_AGE_SECONDS = 86400; // 24 hours

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
