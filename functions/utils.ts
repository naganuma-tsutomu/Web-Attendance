export async function signCookie(payload: string, secret: string) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${payload}.${sigHex}`;
}

export async function verifyCookie(token: string, secret: string) {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const expected = await signCookie(payload, secret);
    return expected === token;
}
