-- Keep exactly one monthly submission record per staff member.
-- Preserve a submitted state when any duplicate row was already submitted.
UPDATE shift_preferences
SET submitted = (
    SELECT MAX(CASE WHEN duplicate.submitted = 1 THEN 1 ELSE 0 END)
    FROM shift_preferences AS duplicate
    WHERE duplicate.staffId = shift_preferences.staffId
      AND duplicate.yearMonth = shift_preferences.yearMonth
)
WHERE id IN (
    SELECT MIN(id)
    FROM shift_preferences
    GROUP BY staffId, yearMonth
);

DELETE FROM shift_preferences
WHERE id NOT IN (
    SELECT MIN(id)
    FROM shift_preferences
    GROUP BY staffId, yearMonth
);

DROP INDEX IF EXISTS idx_shift_preferences_staffid_ym;
CREATE UNIQUE INDEX idx_shift_preferences_staffid_ym
    ON shift_preferences(staffId, yearMonth);
