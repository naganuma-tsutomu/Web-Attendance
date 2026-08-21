-- CI/local safety gate. Each query deliberately raises an error when invalid data exists.
SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE json_extract('invalid orphan staff', '$') END
FROM shifts s
LEFT JOIN staffs st ON st.id = s.staffId
WHERE s.staffId <> 'UNASSIGNED' AND st.id IS NULL;

SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE json_extract('invalid orphan class', '$') END
FROM shifts s
LEFT JOIN classes c ON c.id = s.classType
WHERE c.id IS NULL;

SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE json_extract('invalid duplicate duty number', '$') END
FROM (
    SELECT date, classType, duty_number
    FROM shifts
    WHERE duty_number IS NOT NULL
    GROUP BY date, classType, duty_number
    HAVING COUNT(*) > 1
);

SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE json_extract('invalid access key', '$') END
FROM staffs
WHERE access_key IS NOT NULL AND access_key NOT GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]';

SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE json_extract('duplicate access key', '$') END
FROM (
    SELECT access_key FROM staffs WHERE access_key IS NOT NULL
    GROUP BY access_key HAVING COUNT(*) > 1
);
