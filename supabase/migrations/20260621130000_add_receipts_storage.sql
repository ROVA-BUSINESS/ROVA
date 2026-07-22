-- Create storage bucket for receipts if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880, -- 5MB limit at storage level
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload receipts to their own user_id directory
CREATE POLICY "Users can upload receipts to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view receipts in their own user_id directory
CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete receipts in their own user_id directory
CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
