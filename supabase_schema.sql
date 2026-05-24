-- SQL Schema for Web Audio Recorder
-- This script sets up the database table and RLS (Row Level Security) policies for both the table and storage bucket.

-- Enable UUID extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the audio_metadata table
CREATE TABLE IF NOT EXISTS public.audio_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on the table
ALTER TABLE public.audio_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies for audio_metadata
-- Policy to allow users to insert their own records
CREATE POLICY "Allow authenticated users to insert their own metadata"
ON public.audio_metadata
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to select only their own records
CREATE POLICY "Allow authenticated users to view their own metadata"
ON public.audio_metadata
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy to allow users to delete their own records
CREATE POLICY "Allow authenticated users to delete their own metadata"
ON public.audio_metadata
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 2. Storage Bucket Setup and RLS Policies
-- Note: In Supabase, bucket creation can be done in the Dashboard, or via SQL on the storage schema.
-- We ensure the private bucket 'audio-records' exists.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audio-records', 'audio-records', false, 52428800, '{audio/mpeg,audio/mp3}') -- 50MB limit, only mp3
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage.objects
-- Allow authenticated users to upload (insert) files to their own folder within the bucket
-- We will structure the paths inside the bucket as: `audio-records/{user_id}/{filename}`
CREATE POLICY "Allow authenticated uploads to user directory"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'audio-records' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read (select) their own files
CREATE POLICY "Allow authenticated select of own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'audio-records'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated delete of own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'audio-records'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
