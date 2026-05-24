import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock browser global APIs that do not exist or are stubbed in jsdom
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-audio-url');
  window.URL.revokeObjectURL = vi.fn();
  
  // Mock HTMLMediaElement methods (jsdom stubs don't return Promises for play())
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();

  // Mock crypto.randomUUID with a valid RFC4122 v4 UUID
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = () => '90917e1c-5c8e-4a6f-87e3-0d3a77df3ec3';
  }

  // Mock AudioContext for Web Audio API
  const mockAudioAnalyser = {
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 255);
      }
    }),
    getByteTimeDomainData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  const mockAudioSource = {
    connect: vi.fn()
  };

  class MockAudioContext {
    state = 'running';
    createMediaStreamSource() {
      return mockAudioSource;
    }
    createAnalyser() {
      return mockAudioAnalyser;
    }
    close() {
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
  }

  (window as any).AudioContext = MockAudioContext;
  (window as any).webkitAudioContext = MockAudioContext;

  // Mock MediaRecorder
  class MockMediaRecorder {
    state = 'inactive';
    stream: any;
    options: any;
    ondataavailable: ((e: any) => void) | null = null;
    onstop: (() => void) | null = null;

    constructor(stream: any, options: any) {
      this.stream = stream;
      this.options = options;
    }

    start() {
      this.state = 'recording';
      setTimeout(() => {
        if (this.ondataavailable) {
          const dummyBlob = new Blob(['dummy audio data'], { type: 'audio/webm' });
          this.ondataavailable({ data: dummyBlob });
        }
      }, 50);
    }

    pause() {
      this.state = 'paused';
    }

    resume() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      if (this.onstop) {
        this.onstop();
      }
    }
  }

  (window as any).MediaRecorder = MockMediaRecorder;
  (MockMediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

  // Mock getUserMedia
  if (!navigator.mediaDevices) {
    (navigator as any).mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [
      {
        stop: vi.fn(),
        enabled: true
      }
    ]
  });
}
