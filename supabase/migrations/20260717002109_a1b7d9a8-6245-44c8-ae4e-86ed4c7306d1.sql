
CREATE POLICY "media anon read" ON storage.objects FOR SELECT TO anon USING (bucket_id='media');
CREATE POLICY "media auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='media');
CREATE POLICY "media auth upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='media' AND (storage.foldername(name))[1] = auth.uid()::text);
