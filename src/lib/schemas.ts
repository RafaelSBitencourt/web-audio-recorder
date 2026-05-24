import { z } from 'zod';

// Schema for validating audio metadata before database insertion
export const AudioMetadataInputSchema = z.object({
  user_id: z.string().uuid({ message: 'Invalid user ID format' }),
  bucket_path: z.string().min(1, { message: 'Bucket path is required' }),
  size_bytes: z.number().int().positive({ message: 'Size must be a positive integer' }),
  duration_sec: z.number().int().nonnegative({ message: 'Duration must be a non-negative integer' }),
});

export type AudioMetadataInput = z.infer<typeof AudioMetadataInputSchema>;

// Complete Audio Metadata structure as retrieved from the database
export interface AudioMetadata {
  id: string;
  user_id: string;
  bucket_path: string;
  size_bytes: number;
  duration_sec: number;
  created_at: string;
}

// User Session structure for our app UI
export interface AppUser {
  id: string;
  email: string;
  provider?: string;
}
