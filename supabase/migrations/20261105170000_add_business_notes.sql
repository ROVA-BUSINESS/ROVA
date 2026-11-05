-- Create business_notes table for Rova Notes Pad
CREATE TABLE IF NOT EXISTS public.business_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  color TEXT DEFAULT 'default',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.business_notes ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist
DROP POLICY IF EXISTS "Users can view their own notes" ON public.business_notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.business_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.business_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.business_notes;

-- Create RLS Policies
CREATE POLICY "Users can view their own notes"
  ON public.business_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON public.business_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.business_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.business_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_business_notes_user_updated 
  ON public.business_notes (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_notes_pinned 
  ON public.business_notes (user_id, is_pinned DESC, updated_at DESC);
