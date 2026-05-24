import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AudioMetadata, AudioMetadataInput, AppUser } from './schemas';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let isMockModeTemp = !supabaseUrl || !supabaseAnonKey || 
  supabaseUrl === 'your_supabase_project_url' || 
  supabaseAnonKey === 'your_supabase_anon_public_key';

let supabase: SupabaseClient | null = null;
let clientInitError: string | null = null;

if (!isMockModeTemp) {
  try {
    if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
      throw new Error('A URL do Supabase deve iniciar com http:// ou https://');
    }
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    clientInitError = (error as Error).message;
    isMockModeTemp = true; // Fallback to mock mode
  }
}

export const isMockMode = isMockModeTemp;
export const getClientInitError = () => clientInitError;


// ==========================================
// IndexedDB Helper for Mock Mode Audio Files
// ==========================================
const DB_NAME = 'WebAudioRecorderDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';

function getIDBDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

async function saveFileToIDB(path: string, blob: Blob): Promise<void> {
  const db = await getIDBDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, path);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getFileFromIDB(path: string): Promise<Blob> {
  const db = await getIDBDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(path);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
      } else {
        reject(new Error(`File not found: ${path}`));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteFileFromIDB(path: string): Promise<void> {
  const db = await getIDBDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(path);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// AUTHENTICATION INTERFACE AND IMPLEMENTATIONS
// ==========================================
export interface IAuthService {
  signUp(email: string, password: string): Promise<{ user: AppUser | null; error: Error | null }>;
  signIn(email: string, password: string): Promise<{ user: AppUser | null; error: Error | null }>;
  signOut(): Promise<{ error: Error | null }>;
  getCurrentUser(): Promise<AppUser | null>;
  onAuthStateChange(callback: (user: AppUser | null) => void): () => void;
}

class SupabaseAuthService implements IAuthService {
  async signUp(email: string, password: string) {
    if (!supabase) return { user: null, error: new Error('Supabase client not initialized') };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { user: null, error };
    return {
      user: data.user ? { id: data.user.id, email: data.user.email || '' } : null,
      error: null
    };
  }

  async signIn(email: string, password: string) {
    if (!supabase) return { user: null, error: new Error('Supabase client not initialized') };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error };
    return {
      user: data.user ? { id: data.user.id, email: data.user.email || '' } : null,
      error: null
    };
  }

  async signOut() {
    if (!supabase) return { error: new Error('Supabase client not initialized') };
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  async getCurrentUser() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email || '' } : null;
  }

  onAuthStateChange(callback: (user: AppUser | null) => void) {
    if (!supabase) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? { id: session.user.id, email: session.user.email || '' } : null);
    });
    return () => subscription.unsubscribe();
  }
}

class MockAuthService implements IAuthService {
  private listeners: Set<(user: AppUser | null) => void> = new Set();
  private currentUser: AppUser | null = null;

  constructor() {
    const saved = localStorage.getItem('web_audio_recorder_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch {
        this.currentUser = null;
      }
    }
  }

  async signUp(email: string, password: string) {
    if (password.length < 6) {
      return { user: null, error: new Error('Password must be at least 6 characters') };
    }
    // Simulate signup - save user
    const usersJson = localStorage.getItem('web_audio_recorder_users') || '[]';
    const users = JSON.parse(usersJson) as Array<{ id: string, email: string }>;
    
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { user: null, error: new Error('User already exists') };
    }

    const newUser = { id: crypto.randomUUID(), email: email.toLowerCase() };
    users.push(newUser);
    localStorage.setItem('web_audio_recorder_users', JSON.stringify(users));

    this.currentUser = newUser;
    localStorage.setItem('web_audio_recorder_user', JSON.stringify(newUser));
    this.notify();

    return { user: newUser, error: null };
  }

  async signIn(email: string, password: string) {
    if (password.length < 6) {
      return { user: null, error: new Error('Invalid credentials') };
    }
    const usersJson = localStorage.getItem('web_audio_recorder_users') || '[]';
    const users = JSON.parse(usersJson) as Array<{ id: string, email: string }>;
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // For convenience in testing mock mode, if user doesn't exist, create them
      return this.signUp(email, password);
    }

    this.currentUser = user;
    localStorage.setItem('web_audio_recorder_user', JSON.stringify(user));
    this.notify();

    return { user, error: null };
  }

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem('web_audio_recorder_user');
    this.notify();
    return { error: null };
  }

  async getCurrentUser() {
    return this.currentUser;
  }

  onAuthStateChange(callback: (user: AppUser | null) => void) {
    this.listeners.add(callback);
    // Initial call
    callback(this.currentUser);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }
}

// ==========================================
// AUDIO STORAGE INTERFACE AND IMPLEMENTATIONS
// ==========================================
export interface IAudioService {
  uploadAudio(blob: Blob, filename: string, userId: string): Promise<{ path: string; error: Error | null }>;
  saveMetadata(metadata: AudioMetadataInput): Promise<{ data: AudioMetadata | null; error: Error | null }>;
  listAudios(userId: string): Promise<{ data: AudioMetadata[]; error: Error | null }>;
  getSignedUrl(bucketPath: string): Promise<{ url: string; error: Error | null }>;
  deleteAudio(id: string, bucketPath: string): Promise<{ error: Error | null }>;
}

class SupabaseAudioService implements IAudioService {
  async uploadAudio(blob: Blob, filename: string, userId: string) {
    if (!supabase) return { path: '', error: new Error('Supabase client not initialized') };
    
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${userId}/${Date.now()}_${cleanFilename}`;
    
    const { data, error } = await supabase.storage
      .from('audio-records')
      .upload(path, blob, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false
      });
      
    if (error) return { path: '', error };
    return { path: data.path, error: null };
  }

  async saveMetadata(metadata: AudioMetadataInput) {
    if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };
    
    const { data, error } = await supabase
      .from('audio_metadata')
      .insert({
        user_id: metadata.user_id,
        bucket_path: metadata.bucket_path,
        size_bytes: metadata.size_bytes,
        duration_sec: metadata.duration_sec
      })
      .select()
      .single();
      
    if (error) return { data: null, error };
    return { data: data as AudioMetadata, error: null };
  }

  async listAudios(userId: string) {
    if (!supabase) return { data: [], error: new Error('Supabase client not initialized') };
    
    const { data, error } = await supabase
      .from('audio_metadata')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) return { data: [], error };
    return { data: data as AudioMetadata[], error: null };
  }

  async getSignedUrl(bucketPath: string) {
    if (!supabase) return { url: '', error: new Error('Supabase client not initialized') };
    
    // Generate signed URL valid for 60 seconds
    const { data, error } = await supabase.storage
      .from('audio-records')
      .createSignedUrl(bucketPath, 60);
      
    if (error) return { url: '', error };
    return { url: data.signedUrl, error: null };
  }

  async deleteAudio(id: string, bucketPath: string) {
    if (!supabase) return { error: new Error('Supabase client not initialized') };
    
    // 1. Delete from storage
    const { error: storageError } = await supabase.storage
      .from('audio-records')
      .remove([bucketPath]);
      
    if (storageError) {
      console.warn('Storage file deletion failed or file already deleted:', storageError);
    }
    
    // 2. Delete from database
    const { error: dbError } = await supabase
      .from('audio_metadata')
      .delete()
      .eq('id', id);
      
    return { error: dbError };
  }
}

class MockAudioService implements IAudioService {
  async uploadAudio(blob: Blob, filename: string, userId: string) {
    try {
      const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${userId}/${Date.now()}_${cleanFilename}`;
      
      // Save original blob into IndexedDB with the path as key
      await saveFileToIDB(path, blob);
      return { path, error: null };
    } catch (err) {
      return { path: '', error: err as Error };
    }
  }

  async saveMetadata(metadata: AudioMetadataInput) {
    try {
      const dbRecordsJson = localStorage.getItem('web_audio_recorder_metadata') || '[]';
      const records = JSON.parse(dbRecordsJson) as AudioMetadata[];
      
      const newRecord: AudioMetadata = {
        id: crypto.randomUUID(),
        user_id: metadata.user_id,
        bucket_path: metadata.bucket_path,
        size_bytes: metadata.size_bytes,
        duration_sec: metadata.duration_sec,
        created_at: new Date().toISOString()
      };
      
      records.unshift(newRecord);
      localStorage.setItem('web_audio_recorder_metadata', JSON.stringify(records));
      return { data: newRecord, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  }

  async listAudios(userId: string) {
    try {
      const dbRecordsJson = localStorage.getItem('web_audio_recorder_metadata') || '[]';
      const records = JSON.parse(dbRecordsJson) as AudioMetadata[];
      
      // Filter by current user
      const userRecords = records.filter(r => r.user_id === userId);
      return { data: userRecords, error: null };
    } catch (err) {
      return { data: [], error: err as Error };
    }
  }

  async getSignedUrl(bucketPath: string) {
    try {
      // Get file blob from IndexedDB and return an object URL representing the "Signed URL"
      const blob = await getFileFromIDB(bucketPath);
      const url = URL.createObjectURL(blob);
      return { url, error: null };
    } catch (err) {
      return { url: '', error: err as Error };
    }
  }

  async deleteAudio(id: string, bucketPath: string) {
    try {
      // 1. Delete from IndexedDB
      await deleteFileFromIDB(bucketPath).catch(err => {
        console.warn('File not found in local IndexedDB storage:', err);
      });
      
      // 2. Delete from metadata list
      const dbRecordsJson = localStorage.getItem('web_audio_recorder_metadata') || '[]';
      const records = JSON.parse(dbRecordsJson) as AudioMetadata[];
      const filtered = records.filter(r => r.id !== id);
      localStorage.setItem('web_audio_recorder_metadata', JSON.stringify(filtered));
      
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }
}

// Exports based on Mode
export const authService: IAuthService = isMockMode ? new MockAuthService() : new SupabaseAuthService();
export const audioService: IAudioService = isMockMode ? new MockAudioService() : new SupabaseAudioService();
