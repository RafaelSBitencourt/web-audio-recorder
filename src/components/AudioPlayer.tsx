import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, X } from 'lucide-react';

interface AudioPlayerProps {
  url: string;
  title: string;
  durationSec: number;
  onClose: () => void;
  onDownload: () => void;
  onPlayStateChange: (isPlaying: boolean) => void;
}

export function AudioPlayer({ url, title, durationSec, onClose, onDownload, onPlayStateChange }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state with parent on unmount or pause
  useEffect(() => {
    return () => {
      onPlayStateChange(false);
    };
  }, [onPlayStateChange]);

  // Load new audio URL
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.load();
      // Try to autoplay when a new audio is loaded
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          onPlayStateChange(true);
        })
        .catch(() => {
          setIsPlaying(false);
          onPlayStateChange(false);
        });
    }
  }, [url, onPlayStateChange]);

  // Handle Play / Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
      onPlayStateChange(true);
    }
  };

  // Handle Audio events
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    // Set exact duration from metadata if available
    if (audioRef.current.duration) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    onPlayStateChange(false);
  };

  // Seek
  const handleSeek = (value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  // Volume
  const handleVolumeChange = (value: number) => {
    if (!audioRef.current) return;
    setVolume(value);
    audioRef.current.volume = value;
    if (value > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  // Speed
  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackRate(nextSpeed);
    audioRef.current.playbackRate = nextSpeed;
  };

  // Format seconds to mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="player-card">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />
      
      <div className="player-header">
        <div className="player-title" title={title}>
          Tocando: {title}
        </div>
        <button className="action-icon-btn btn-delete" onClick={onClose} title="Fechar Player">
          <X size={16} />
        </button>
      </div>

      <div className="player-slider-section">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="player-slider"
        />
        <div className="player-time-info">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-controls">
        <div className="player-left-controls">
          <button className="btn-play-toggle" onClick={togglePlay} aria-label={isPlaying ? 'Pausar' : 'Tocar'}>
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: 3 }} />}
          </button>
          
          <div className="speed-badge" onClick={cycleSpeed} title="Alterar velocidade de reprodução">
            {playbackRate}x
          </div>
        </div>

        <div className="player-right-controls">
          <div className="volume-container">
            <button className="action-icon-btn" onClick={toggleMute} title={isMuted ? 'Desmutar' : 'Mutar'}>
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="volume-slider"
            />
          </div>

          <button className="control-btn" onClick={onDownload} title="Baixar MP3 de forma segura">
            <Download size={16} />
            <span>Baixar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AudioPlayer;
