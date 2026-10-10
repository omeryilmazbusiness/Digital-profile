-- The designed business card visitors save as an image ("Save business card").
ALTER TABLE profile
    -- NO ACTION, like the portrait: the image stays in the library while the card uses it.
    ADD COLUMN business_card_media_id uuid REFERENCES media (id);

CREATE INDEX profile_business_card_media_id_idx ON profile (business_card_media_id);
