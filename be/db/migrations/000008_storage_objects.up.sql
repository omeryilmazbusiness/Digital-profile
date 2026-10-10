-- Uploaded files kept in the database (STORAGE_DRIVER=postgres), for deployments without a
-- persistent disk or object store: they persist and are backed up with the rest of the data.
CREATE TABLE storage_objects (
    key          text        PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 512),
    content_type text        NOT NULL,
    data         bytea       NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- WebP and PDF are already compressed: store them out of line without trying again.
ALTER TABLE storage_objects ALTER COLUMN data SET STORAGE EXTERNAL;
