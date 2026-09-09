type SafeParseSchema<T> = {
    safeParse: (value: unknown) =>
        | { success: true; data: T }
        | { success: false };
};

export const parseStoredJsonSetting = <T>(
    value: string | null | undefined,
    schema: SafeParseSchema<T>,
    fallback: T,
): T => {
    if (!value) return fallback;
    try {
        const parsed = schema.safeParse(JSON.parse(value));
        return parsed.success ? parsed.data : fallback;
    } catch {
        return fallback;
    }
};
