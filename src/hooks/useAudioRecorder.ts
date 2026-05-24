import { useState, useRef, useEffect, useCallback } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'transcoding' | 'uploading' | 'error' | 'success';

interface UseAudioRecorderResult {
  status: RecorderStatus;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  rawBlob: Blob | null;
  mp3Blob: Blob | null;
  progress: number;
  errorMessage: string | null;
  analyserNode: AnalyserNode | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecorder: () => void;
  setUploadingStatus: () => void;
  setSuccessStatus: (mp3: Blob) => void;
  setErrorStatus: (err: string) => void;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker for FFmpeg transcoding
  useEffect(() => {
    // Vite Web Worker instantiation
    const worker = new Worker(
      new URL('../workers/ffmpeg.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent) => {
      const { type, progress, blob, error } = event.data;

      if (type === 'loaded') {
        console.log('[Recorder] FFmpeg core loaded in Web Worker.');
      } else if (type === 'progress') {
        setProgress(progress);
      } else if (type === 'success') {
        setMp3Blob(blob);
        setStatus('success');
      } else if (type === 'error') {
        setErrorMessage(error);
        setStatus('error');
      }
    };

    workerRef.current = worker;

    // Pre-load FFmpeg on mount to save time later
    worker.postMessage({ type: 'load' });

    return () => {
      worker.terminate();
    };
  }, []);

  // Update timer every second when recording
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Clean up recording streams on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setErrorMessage(null);
      setRawBlob(null);
      setMp3Blob(null);
      setProgress(0);
      setRecordingTime(0);
      chunksRef.current = [];

      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Set up Web Audio API for visualizer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; // High frequency granularity not needed for voice
      source.connect(analyser);
      setAnalyserNode(analyser);

      // 3. Set up MediaRecorder
      // Choose supported format (WebM is standard, MP4/AAC on Safari/iOS)
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/mp4' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/ogg' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: '' }; // fallback to default browser encoder
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Collect recorded pieces
        const rawAudioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setRawBlob(rawAudioBlob);

        // 4. Delegate to FFmpeg Web Worker for transcoding
        setStatus('transcoding');
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'transcode', blob: rawAudioBlob });
        } else {
          setErrorMessage('Transcoder não inicializado.');
          setStatus('error');
        }
      };

      // Start recording
      mediaRecorder.start(250); // Slice data every 250ms
      setStatus('recording');
    } catch (error) {
      console.error('[Recorder] Error starting recording:', error);
      setErrorMessage(
        (error as Error).name === 'NotAllowedError'
          ? 'Permissão de microfone negada pelo usuário.'
          : `Erro ao acessar o microfone: ${(error as Error).message}`
      );
      setStatus('error');
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.pause();
      if (audioContextRef.current) {
        audioContextRef.current.suspend().catch(console.error);
      }
      setStatus('paused');
    }
  }, [status]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'paused') {
      mediaRecorderRef.current.resume();
      if (audioContextRef.current) {
        audioContextRef.current.resume().catch(console.error);
      }
      setStatus('recording');
    }
  }, [status]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (status === 'recording' || status === 'paused')) {
      mediaRecorderRef.current.stop();
      
      // Stop microphone stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }

      setAnalyserNode(null);
    }
  }, [status]);

  const resetRecorder = useCallback(() => {
    setStatus('idle');
    setRecordingTime(0);
    setRawBlob(null);
    setMp3Blob(null);
    setProgress(0);
    setErrorMessage(null);
    setAnalyserNode(null);
  }, []);

  const setUploadingStatus = useCallback(() => {
    setStatus('uploading');
  }, []);

  const setSuccessStatus = useCallback((mp3: Blob) => {
    setMp3Blob(mp3);
    setStatus('success');
  }, []);

  const setErrorStatus = useCallback((err: string) => {
    setErrorMessage(err);
    setStatus('error');
  }, []);

  return {
    status,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    recordingTime,
    rawBlob,
    mp3Blob,
    progress,
    errorMessage,
    analyserNode,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecorder,
    setUploadingStatus,
    setSuccessStatus,
    setErrorStatus
  };
}
export default useAudioRecorder;
