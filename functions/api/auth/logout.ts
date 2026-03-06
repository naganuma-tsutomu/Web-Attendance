export const onRequestPost: PagesFunction = async (context) => {
    const isSecure = context.request.url.startsWith('https');
    const cookie = `auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${isSecure ? '; Secure' : ''}`;
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': cookie
        }
    });
};
