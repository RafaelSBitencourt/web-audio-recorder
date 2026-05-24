import { describe, it, expect } from 'vitest';
import { AudioMetadataInputSchema } from '../lib/schemas';

describe('AudioMetadataInputSchema Validation', () => {
  const validPayload = {
    user_id: '90917e1c-5c8e-4a6f-87e3-0d3a77df3ec3', // Valid v4 UUID
    bucket_path: 'user_uuid/1716584289_recording.mp3',
    size_bytes: 1024 * 100, // 100 KB
    duration_sec: 15, // 15 seconds
  };

  it('should accept valid payloads', () => {
    const result = AudioMetadataInputSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validPayload);
    }
  });

  it('should reject payloads with invalid user_id UUID formats', () => {
    const payload = {
      ...validPayload,
      user_id: 'invalid-uuid-format',
    };
    const result = AudioMetadataInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid user ID format');
    }
  });

  it('should reject payloads with empty or missing bucket_path', () => {
    const payload = {
      ...validPayload,
      bucket_path: '',
    };
    const result = AudioMetadataInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Filter out user_id errors if any, though here user_id is valid
      const bucketIssue = result.error.issues.find(i => i.path.includes('bucket_path'));
      expect(bucketIssue?.message).toContain('Bucket path is required');
    }
  });

  it('should reject payloads with negative size_bytes', () => {
    const payload = {
      ...validPayload,
      size_bytes: -100,
    };
    const result = AudioMetadataInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const sizeIssue = result.error.issues.find(i => i.path.includes('size_bytes'));
      expect(sizeIssue?.message).toContain('Size must be a positive integer');
    }
  });

  it('should reject payloads with non-integer size_bytes', () => {
    const payload = {
      ...validPayload,
      size_bytes: 12.34,
    };
    const result = AudioMetadataInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject payloads with negative duration_sec', () => {
    const payload = {
      ...validPayload,
      duration_sec: -5,
    };
    const result = AudioMetadataInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const durationIssue = result.error.issues.find(i => i.path.includes('duration_sec'));
      expect(durationIssue?.message).toContain('Duration must be a non-negative integer');
    }
  });
});
