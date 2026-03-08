-- shift_requirements テーブル作成
-- クラスと時間帯ごとの必要スタッフ数設定を管理するテーブル

CREATE TABLE IF NOT EXISTS shift_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 7),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    min_staff_count INTEGER NOT NULL CHECK (min_staff_count >= 0),
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_shift_requirements_class_id ON shift_requirements(class_id);
CREATE INDEX idx_shift_requirements_day_of_week ON shift_requirements(day_of_week);

-- updated_at 自動更新用のトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
CREATE TRIGGER update_shift_requirements_updated_at
    BEFORE UPDATE ON shift_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 有効化
ALTER TABLE shift_requirements ENABLE ROW LEVEL SECURITY;

-- ポリシー: 認証済みユーザーのみ全ての操作が可能
CREATE POLICY shift_requirements_all_auth ON shift_requirements
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ポリシー: 匿名ユーザーは読み取りのみ可能（必要に応じて）
-- CREATE POLICY shift_requirements_select_anon ON shift_requirements
--     FOR SELECT
--     TO anon
--     USING (true);

COMMENT ON TABLE shift_requirements IS 'クラスと時間帯ごとの必要スタッフ数設定';
COMMENT ON COLUMN shift_requirements.class_id IS 'クラスID（classesテーブルへの参照）';
COMMENT ON COLUMN shift_requirements.day_of_week IS '曜日パターン (0-6: 日-土, 7: 平日)';
COMMENT ON COLUMN shift_requirements.start_time IS '開始時間 (HH:MM形式)';
COMMENT ON COLUMN shift_requirements.end_time IS '終了時間 (HH:MM形式)';
COMMENT ON COLUMN shift_requirements.min_staff_count IS '最低必要スタッフ数';
COMMENT ON COLUMN shift_requirements.priority IS '優先度 (1-5, 高いほど優先)';
