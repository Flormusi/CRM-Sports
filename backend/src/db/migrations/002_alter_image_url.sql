-- Increase image_url column size to support long CDN URLs
ALTER TABLE products
  ALTER COLUMN image_url TYPE TEXT;

