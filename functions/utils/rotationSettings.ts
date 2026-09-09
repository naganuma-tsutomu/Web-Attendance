import { RotationSettingsSchema } from '../../shared/appSettingsSchemas';

export const DEFAULT_ROTATION_SETTINGS = RotationSettingsSchema.parse({});

export const loadRotationSettings = async (db: D1Database) => {
    const row = await db.prepare(
        "SELECT value FROM app_settings WHERE key = 'rotation_settings'"
    ).first<{ value: string }>();
    if (!row) return DEFAULT_ROTATION_SETTINGS;

    try {
        const parsed = RotationSettingsSchema.safeParse(JSON.parse(row.value));
        return parsed.success ? parsed.data : DEFAULT_ROTATION_SETTINGS;
    } catch {
        return DEFAULT_ROTATION_SETTINGS;
    }
};
