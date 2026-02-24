-- Normalize existing customer phone numbers to digits only (match app logic).
-- Strips non-digits and leading US "1" when 11 digits, so lookups find the same row.
UPDATE customers
SET phone_number = CASE
  WHEN length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 11
       AND substring(regexp_replace(phone_number, '[^0-9]', '', 'g') from 1 for 1) = '1'
  THEN substring(regexp_replace(phone_number, '[^0-9]', '', 'g') from 2)
  ELSE regexp_replace(phone_number, '[^0-9]', '', 'g')
END;
