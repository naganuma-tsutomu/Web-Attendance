import { RotationSettingsSchema } from '../../shared/appSettingsSchemas';
import { parseStoredJsonSetting } from './appSettings';

export const DEFAULT_ROTATION_SETTINGS = RotationSettingsSchema.parse({});

export const loadRotationSettings = async (db: D1Database) => {
    const row = await db.prepare(
        "SELECT value FROM app_settings WHERE key = 'rotation_settings'"
    ).first<{ value: string }>();
    if (!row) return DEFAULT_ROTATION_SETTINGS;
    return parseStoredJsonSetting(row.value, RotationSettingsSchema, DEFAULT_ROTATION_SETTINGS);
};
