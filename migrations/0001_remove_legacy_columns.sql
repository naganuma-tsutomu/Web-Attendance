-- Drop legacy columns availableDays from staffs and unavailableDates from shift_preferences
ALTER TABLE staffs DROP COLUMN availableDays;
ALTER TABLE shift_preferences DROP COLUMN unavailableDates;
