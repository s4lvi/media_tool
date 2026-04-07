-- Storage RLS policies for all buckets
-- Authenticated users can upload to any bucket
-- Anyone can read from public buckets

-- FRAMES bucket
CREATE POLICY "Authenticated users can upload frames"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'frames');

CREATE POLICY "Anyone can read frames"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'frames');

CREATE POLICY "Authenticated users can delete frames"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'frames');

-- ASSETS bucket
CREATE POLICY "Authenticated users can upload assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Anyone can read assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'assets');

CREATE POLICY "Authenticated users can delete assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'assets');

-- EXPORTS bucket
CREATE POLICY "Authenticated users can upload exports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exports');

CREATE POLICY "Anyone can read exports"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'exports');

-- THUMBNAILS bucket
CREATE POLICY "Authenticated users can upload thumbnails"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "Anyone can read thumbnails"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'thumbnails');
