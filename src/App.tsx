import { useState, useEffect, useCallback } from 'react';
import { 
  Mic, Square, Pause, Play, RefreshCw, LogOut, 
  Sun, Moon, AudioLines, AlertTriangle, ShieldAlert
} from 'lucide-react';

import { authService, audioService, isMockMode, getClientInitError } from './lib/supabase';
import type { AudioMetadata, AppUser } from './lib/schemas';
import { AudioMetadataInputSchema } from './lib/schemas';
import { useAudioRecorder } from './hooks/useAudioRecorder';

import Auth from './components/Auth';
import AudioVisualizer from './components/AudioVisualizer';
import AudioPlayer from './components/AudioPlayer';
import AudioHistory from './components/AudioHistory';

function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [audios, setAudios] = useState<AudioMetadata[]>([]);
  const [audiosLoading, setAudiosLoading] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  // Playback state
  const [selectedAudio, setSelectedAudio] = useState<AudioMetadata | null>(null);
  const [signedPlayUrl, setSignedPlayUrl] = useState<string>('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Custom recorder hook
  const recorder = useAudioRecorder();

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('web_audio_recorder_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  // Load initialization errors if any
  useEffect(() => {
    const initError = getClientInitError();
    if (initError) {
      setAppError(`Erro ao inicializar o Supabase: ${initError}. O aplicativo foi redirecionado para o modo offline (Mock Mode).`);
    }
  }, []);

  // Monitor auth state changes
  useEffect(() => {
    // Safety timer to prevent infinite loading screen in case of unforeseen auth listener delays
    const safetyTimeout = setTimeout(() => {
      setAuthLoading(false);
    }, 1500);

    const unsubscribe = authService.onAuthStateChange((currentUser) => {
      clearTimeout(safetyTimeout);
      setUser(currentUser);
      setAuthLoading(false);
      
      // Close player and clean lists when user logs out
      if (!currentUser) {
        setAudios([]);
        setSelectedAudio(null);
        setSignedPlayUrl('');
        setIsAudioPlaying(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  // Fetch audios for the logged-in user
  const fetchAudios = useCallback(async (userId: string) => {
    setAudiosLoading(true);
    setAppError(null);
    try {
      const { data, error } = await audioService.listAudios(userId);
      if (error) throw error;
      setAudios(data);
    } catch (err) {
      console.error('[App] Error fetching audios:', err);
      setAppError('Falha ao carregar histórico de áudios.');
    } finally {
      setAudiosLoading(false);
    }
  }, []);

  // Load user audios when user is loaded
  useEffect(() => {
    if (user) {
      fetchAudios(user.id);
    }
  }, [user, fetchAudios]);

  // Handle file upload and metadata insertion after transcoding completes
  useEffect(() => {
    const uploadTranscodedAudio = async () => {
      if (recorder.status === 'success' && recorder.mp3Blob && user) {
        recorder.setUploadingStatus();
        setAppError(null);
        
        try {
          // 1. Upload MP3 Blob to Storage (or IndexedDB)
          const filename = `recording_${Date.now()}.mp3`;
          const { path: bucketPath, error: uploadErr } = await audioService.uploadAudio(
            recorder.mp3Blob,
            filename,
            user.id
          );
          
          if (uploadErr) throw uploadErr;

          // 2. Prepare payload
          const payload = {
            user_id: user.id,
            bucket_path: bucketPath,
            size_bytes: recorder.mp3Blob.size,
            duration_sec: recorder.recordingTime,
          };

          // 3. Strict payload validation with Zod
          const validation = AudioMetadataInputSchema.safeParse(payload);
          if (!validation.success) {
            const validationErrorMsg = validation.error.issues.map((issue) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${validationErrorMsg}`);
          }

          // 4. Save metadata record to DB
          const { error: dbErr } = await audioService.saveMetadata(validation.data);
          if (dbErr) throw dbErr;

          // 5. Refresh history and reset recorder
          await fetchAudios(user.id);
          recorder.resetRecorder();
        } catch (err) {
          console.error('[App] Upload flow failed:', err);
          setAppError((err as Error).message || 'Erro ao processar e salvar áudio.');
          recorder.setErrorStatus((err as Error).message || 'Erro ao salvar áudio.');
        }
      }
    };

    uploadTranscodedAudio();
  }, [recorder.status, recorder.mp3Blob, user, recorder.recordingTime, fetchAudios]);

  // Toggle Theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('web_audio_recorder_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await authService.signOut();
    } catch (err) {
      console.error('[App] Error signing out:', err);
    }
  };

  // Select an audio to play from list
  const handleSelectAudio = async (audio: AudioMetadata) => {
    setAppError(null);
    try {
      setSelectedAudio(audio);
      
      // Request a temporary Signed URL on-demand
      const { url, error } = await audioService.getSignedUrl(audio.bucket_path);
      if (error) throw error;
      
      setSignedPlayUrl(url);
    } catch (err) {
      console.error('[App] Error generating signed URL:', err);
      setAppError('Falha ao abrir áudio de forma segura.');
      setSelectedAudio(null);
      setSignedPlayUrl('');
    }
  };

  // Download audio via Signed URL
  const handleDownloadAudio = async (audio: AudioMetadata) => {
    setAppError(null);
    try {
      // 1. Get temporary Signed URL on-demand
      const { url, error } = await audioService.getSignedUrl(audio.bucket_path);
      if (error) throw error;
      
      // 2. Extract title
      const pathParts = audio.bucket_path.split('/');
      const fileFullName = pathParts[pathParts.length - 1];
      const title = fileFullName.replace(/^\d+_/, '');

      // 3. Trigger download using browser mechanism
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = title;
      anchor.target = '_blank';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (err) {
      console.error('[App] Download failed:', err);
      setAppError('Não foi possível gerar a URL de download seguro.');
    }
  };

  // Delete audio from history & storage
  const handleDeleteAudio = async (id: string, bucketPath: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta gravação permanentemente?')) return;
    
    setAppError(null);
    try {
      const { error } = await audioService.deleteAudio(id, bucketPath);
      if (error) throw error;

      // Close player if playing the deleted file
      if (selectedAudio && selectedAudio.id === id) {
        setSelectedAudio(null);
        setSignedPlayUrl('');
        setIsAudioPlaying(false);
      }

      if (user) {
        await fetchAudios(user.id);
      }
    } catch (err) {
      console.error('[App] Error deleting audio:', err);
      setAppError('Falha ao excluir o áudio.');
    }
  };

  // Format recording seconds to mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (authLoading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="brand-section">
            <AudioLines className="logo-icon" />
            <h1 className="brand-title">Web Audio Recorder</h1>
          </div>
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Alternar Tema">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>
        <Auth onAuthSuccess={() => {}} />
        <footer className="app-footer">
          <p>© {new Date().getFullYear()} Web Audio Recorder. Processamento Edge Computing.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <AudioLines className="logo-icon" />
          <h1 className="brand-title">Web Audio Recorder</h1>
        </div>
        
        <div className="user-nav">
          {isMockMode ? (
            <span className="badge-mock" title="Executando offline com armazenamento local IndexedDB">
              Local Mode
            </span>
          ) : (
            <span className="badge-connected" title="Conectado ao Supabase Cloud">
              Supabase Cloud
            </span>
          )}
          
          <span className="user-email" style={{ display: 'none' }}>{user.email}</span>
          <span className="user-email" style={{ display: 'inline-block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </span>
          
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Alternar Tema">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button className="control-btn" style={{ padding: '8px 12px' }} onClick={handleSignOut} title="Sair">
            <LogOut size={16} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Sair</span>
          </button>
        </div>
      </header>

      {/* Mock Mode warning banner */}
      {isMockMode && isBannerVisible && (
        <div className="alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} />
            <span>
              <strong>Mock Mode Ativo:</strong> Chaves do Supabase não detectadas no arquivo `.env`. Os dados serão salvos localmente e persistem apenas neste navegador.
            </span>
          </div>
          <button className="alert-banner-close" onClick={() => setIsBannerVisible(false)}>
            ×
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {appError && (
        <div className="error-banner">
          <ShieldAlert className="error-banner-icon" />
          <span>{appError}</span>
        </div>
      )}

      {/* Dashboard Content Grid */}
      <main className="dashboard-grid">
        {/* Left Column - Recorder Card */}
        <div className="glass-card recorder-panel">
          {/* Status Badge */}
          <div className="status-badge">
            {recorder.status === 'recording' && <span className="recording-dot"></span>}
            <span>
              {recorder.status === 'idle' && 'Pronto para Gravar'}
              {recorder.status === 'recording' && 'Gravando Áudio...'}
              {recorder.status === 'paused' && 'Gravação Pausada'}
              {recorder.status === 'transcoding' && 'Edge Transcoding (.mp3)...'}
              {recorder.status === 'uploading' && 'Fazendo Upload Seguro...'}
              {recorder.status === 'error' && 'Erro de Gravação'}
              {recorder.status === 'success' && 'Processamento Concluído'}
            </span>
          </div>

          {/* Time Counter */}
          <div className="timer-display">
            {formatTimer(recorder.recordingTime)}
          </div>

          {/* Real-time Oscilloscope/Wave Visualizer */}
          <AudioVisualizer 
            analyserNode={recorder.analyserNode}
            isRecording={recorder.isRecording}
            isPlaying={isAudioPlaying}
            theme={theme}
          />

          {/* Recorder Controls */}
          {recorder.status === 'transcoding' || recorder.status === 'uploading' ? (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p className="progress-text">
                {recorder.status === 'transcoding' 
                  ? `Convertendo: ${recorder.progress}%` 
                  : 'Enviando arquivo MP3 para a nuvem...'}
              </p>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${recorder.status === 'transcoding' ? recorder.progress : 100}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="rec-control-section">
              {/* Giant REC / STOP Button (10% rule) */}
              {recorder.isRecording || recorder.isPaused ? (
                <button 
                  className="btn-rec recording" 
                  onClick={recorder.stopRecording}
                  title="Parar Gravação"
                >
                  <Square size={28} fill="currentColor" />
                </button>
              ) : (
                <button 
                  className="btn-rec" 
                  onClick={recorder.startRecording}
                  title="Iniciar Gravação (REC)"
                >
                  <Mic size={32} />
                </button>
              )}

              {/* Pause/Resume/Reset Group */}
              <div className="recorder-btn-group">
                {recorder.isRecording && (
                  <button className="control-btn" onClick={recorder.pauseRecording}>
                    <Pause size={16} />
                    <span>Pausar</span>
                  </button>
                )}
                {recorder.isPaused && (
                  <button className="control-btn" onClick={recorder.resumeRecording}>
                    <Play size={16} fill="currentColor" />
                    <span>Retomar</span>
                  </button>
                )}
                {(recorder.status === 'error' || recorder.status === 'success' || recorder.recordingTime > 0) && 
                 !recorder.isRecording && !recorder.isPaused && (
                  <button className="control-btn btn-action-cancel" onClick={recorder.resetRecorder}>
                    <RefreshCw size={16} />
                    <span>Resetar</span>
                  </button>
                )}
              </div>
            </div>
          )}
          
          {recorder.errorMessage && (
            <div className="error-banner" style={{ marginTop: 16 }}>
              <ShieldAlert className="error-banner-icon" />
              <span>{recorder.errorMessage}</span>
            </div>
          )}
        </div>

        {/* Right Column - History Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <AudioHistory 
            audios={audios}
            isLoading={audiosLoading}
            activeAudioId={selectedAudio ? selectedAudio.id : null}
            onSelectAudio={handleSelectAudio}
            onDeleteAudio={handleDeleteAudio}
            onDownloadAudio={handleDownloadAudio}
          />

          {/* Secure Audio Player */}
          {selectedAudio && signedPlayUrl && (
            <AudioPlayer 
              url={signedPlayUrl}
              title={selectedAudio.bucket_path.split('/').pop()?.replace(/^\d+_/, '') || 'gravação.mp3'}
              durationSec={selectedAudio.duration_sec}
              onClose={() => {
                setSelectedAudio(null);
                setSignedPlayUrl('');
                setIsAudioPlaying(false);
              }}
              onDownload={() => handleDownloadAudio(selectedAudio)}
              onPlayStateChange={setIsAudioPlaying}
            />
          )}
        </div>
      </main>

      {/* App Footer */}
      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Web Audio Recorder. Desenvolvido com React, TypeScript & FFmpeg.wasm.</p>
      </footer>
    </div>
  );
}

export default App;
