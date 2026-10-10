DROP INDEX IF EXISTS profile_business_card_media_id_idx;

ALTER TABLE profile DROP COLUMN IF EXISTS business_card_media_id;
