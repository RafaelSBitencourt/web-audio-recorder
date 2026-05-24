import { describe, it, expect, beforeEach } from 'vitest';

// ==========================================
// In-Memory IndexedDB Mock for Testing
// ==========================================
const idbMemoryStore: Record<string, Blob> = {};

const mockIDBRequest = (result: any) => {
  const req: any = {
    onsuccess: null,
    onerror: null,
    result
  };
  setTimeout(() => {
    if (req.onsuccess) req.onsuccess({ target: req });
  }, 5);
  return req;
};

const mockIDBDatabase = {
  objectStoreNames: {
    contains: () => true
  },
  transaction: () => ({
    objectStore: () => ({
      put: (blob: Blob, path: string) => {
        idbMemoryStore[path] = blob;
        return mockIDBRequest(path);
      },
      get: (path: string) => {
        const val = idbMemoryStore[path];
        return mockIDBRequest(val);
      },
      delete: (path: string) => {
        delete idbMemoryStore[path];
        return mockIDBRequest(undefined);
      }
    })
  })
};

const mockIDBFactory = {
  open: () => {
    return mockIDBRequest(mockIDBDatabase);
  }
};

// Apply IndexedDB mock globally for testing MockAudioService
(globalThis as any).indexedDB = mockIDBFactory;

// Import the mock classes directly to test mock behaviour in isolation
import { MockAuthService, MockAudioService } from '../lib/supabase';

describe('Fallback Services (Mock Mode)', () => {
  let authService: MockAuthService;
  let audioService: MockAudioService;

  beforeEach(() => {
    // Clear localStorage and in-memory stores before each test
    localStorage.clear();
    for (const key in idbMemoryStore) {
      delete idbMemoryStore[key];
    }
    // Re-initialize mock services in isolation
    authService = new MockAuthService();
    audioService = new MockAudioService();
  });

  describe('MockAuthService', () => {
    it('should allow signing up a new user and retrieve their session', async () => {
      const email = 'user@example.com';
      const password = 'securepassword';

      const { user, error } = await authService.signUp(email, password);
      
      expect(error).toBeNull();
      expect(user).not.toBeNull();
      expect(user?.email).toBe(email);
      expect(user?.id).toBeDefined();

      const current = await authService.getCurrentUser();
      expect(current).toEqual(user);
    });

    it('should block signups with passwords shorter than 6 characters', async () => {
      const { user, error } = await authService.signUp('test@example.com', '12345');
      expect(user).toBeNull();
      expect(error?.message).toContain('at least 6 characters');
    });

    it('should reject signups for existing emails', async () => {
      await authService.signUp('duplicate@example.com', 'password123');
      const { user, error } = await authService.signUp('duplicate@example.com', 'differentpassword');
      
      expect(user).toBeNull();
      expect(error?.message).toContain('already exists');
    });

    it('should allow signing in an existing user', async () => {
      const email = 'login@example.com';
      await authService.signUp(email, 'password123');
      
      // Logout first
      await authService.signOut();
      expect(await authService.getCurrentUser()).toBeNull();

      // Login
      const { user, error } = await authService.signIn(email, 'password123');
      expect(error).toBeNull();
      expect(user?.email).toBe(email);
      
      expect(await authService.getCurrentUser()).toEqual(user);
    });

    it('should sign out successfully', async () => {
      await authService.signUp('active@example.com', 'password123');
      expect(await authService.getCurrentUser()).not.toBeNull();

      const { error } = await authService.signOut();
      expect(error).toBeNull();
      expect(await authService.getCurrentUser()).toBeNull();
    });
  });

  describe('MockAudioService', () => {
    const userId = '90917e1c-5c8e-4a6f-87e3-0d3a77df3ec3'; // Valid v4 UUID
    const mockAudioBlob = new Blob(['mock audio bits'], { type: 'audio/mp3' });

    it('should upload an audio file to mock storage (IndexedDB)', async () => {
      const filename = 'test-recording.mp3';
      const { path, error } = await audioService.uploadAudio(mockAudioBlob, filename, userId);

      expect(error).toBeNull();
      expect(path).toContain(userId);
      expect(path).toContain(filename.replace(/[^a-zA-Z0-9.-]/g, '_'));
      
      // Verify file exists in mock IndexedDB store
      expect(idbMemoryStore[path]).toEqual(mockAudioBlob);
    });

    it('should save and list metadata records', async () => {
      const bucketPath = `${userId}/123456_test.mp3`;
      const metadataInput = {
        user_id: userId,
        bucket_path: bucketPath,
        size_bytes: 4096,
        duration_sec: 12
      };

      const { data, error } = await audioService.saveMetadata(metadataInput);
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.bucket_path).toBe(bucketPath);
      expect(data?.id).toBeDefined();

      // Retrieve list
      const { data: list, error: listError } = await audioService.listAudios(userId);
      expect(listError).toBeNull();
      expect(list.length).toBe(1);
      expect(list[0].bucket_path).toBe(bucketPath);
    });

    it('should generate a secure URL representing the audio file', async () => {
      const path = `${userId}/audio.mp3`;
      idbMemoryStore[path] = mockAudioBlob;

      const { url, error } = await audioService.getSignedUrl(path);
      expect(error).toBeNull();
      expect(url).toContain('blob:http://localhost/');
    });

    it('should delete audio files and their metadata', async () => {
      const path = `${userId}/audio.mp3`;
      idbMemoryStore[path] = mockAudioBlob;

      const { data } = await audioService.saveMetadata({
        user_id: userId,
        bucket_path: path,
        size_bytes: 1024,
        duration_sec: 5
      });

      const audioId = data!.id;

      // Delete
      const { error: deleteError } = await audioService.deleteAudio(audioId, path);
      expect(deleteError).toBeNull();

      // Verify file removed from IndexedDB mock
      expect(idbMemoryStore[path]).toBeUndefined();

      // Verify metadata removed from list
      const { data: list } = await audioService.listAudios(userId);
      expect(list.length).toBe(0);
    });
  });
});
