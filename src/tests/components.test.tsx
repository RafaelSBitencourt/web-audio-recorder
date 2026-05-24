import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Import components to test
import Auth from '../components/Auth';
import AudioHistory from '../components/AudioHistory';
import AudioPlayer from '../components/AudioPlayer';

describe('UI Component Tests', () => {
  
  describe('Auth Component', () => {
    it('renders login form elements by default', () => {
      const mockSuccess = vi.fn();
      render(<Auth onAuthSuccess={mockSuccess} />);
      
      expect(screen.getByText('Acesse sua Conta')).toBeInTheDocument();
      expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
      expect(screen.getByLabelText('Senha')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
    });

    it('toggles to signup mode when clicking Register', () => {
      const mockSuccess = vi.fn();
      render(<Auth onAuthSuccess={mockSuccess} />);
      
      const toggleLink = screen.getByText('Cadastre-se');
      fireEvent.click(toggleLink);
      
      expect(screen.getByText('Criar Conta')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cadastrar/i })).toBeInTheDocument();
    });
  });

  describe('AudioHistory Component', () => {
    const mockSelect = vi.fn();
    const mockDelete = vi.fn();
    const mockDownload = vi.fn();

    it('renders empty state when there are no audios', () => {
      render(
        <AudioHistory 
          audios={[]} 
          isLoading={false} 
          activeAudioId={null} 
          onSelectAudio={mockSelect} 
          onDeleteAudio={mockDelete} 
          onDownloadAudio={mockDownload}
        />
      );
      
      expect(screen.getByText('Nenhuma gravação encontrada')).toBeInTheDocument();
      expect(screen.getByText(/Clique no botão REC ao lado/i)).toBeInTheDocument();
    });

    it('renders list of audio records with formatted sizes and durations', () => {
      const mockAudios = [
        {
          id: 'audio-1',
          user_id: 'user-1',
          bucket_path: 'user-1/1700000000_my_voice.mp3',
          size_bytes: 1024 * 50, // 50 KB
          duration_sec: 10,
          created_at: new Date().toISOString()
        }
      ];

      render(
        <AudioHistory 
          audios={mockAudios} 
          isLoading={false} 
          activeAudioId={null} 
          onSelectAudio={mockSelect} 
          onDeleteAudio={mockDelete} 
          onDownloadAudio={mockDownload}
        />
      );

      // Verify file title (timestamp stripped)
      expect(screen.getByText('my_voice.mp3')).toBeInTheDocument();
      // Verify size representation (50 KB)
      expect(screen.getByText('50 KB')).toBeInTheDocument();
      // Verify duration representation (0:10)
      expect(screen.getByText('0:10')).toBeInTheDocument();
    });

    it('triggers selection callbacks on click', () => {
      const mockAudios = [
        {
          id: 'audio-1',
          user_id: 'user-1',
          bucket_path: 'user-1/1700000000_my_voice.mp3',
          size_bytes: 1024 * 50,
          duration_sec: 10,
          created_at: new Date().toISOString()
        }
      ];

      render(
        <AudioHistory 
          audios={mockAudios} 
          isLoading={false} 
          activeAudioId={null} 
          onSelectAudio={mockSelect} 
          onDeleteAudio={mockDelete} 
          onDownloadAudio={mockDownload}
        />
      );

      const item = screen.getByText('my_voice.mp3');
      fireEvent.click(item);
      
      expect(mockSelect).toHaveBeenCalledWith(mockAudios[0]);
    });
  });

  describe('AudioPlayer Component', () => {
    const mockClose = vi.fn();
    const mockDownload = vi.fn();
    const mockPlayState = vi.fn();
    const mockUrl = 'blob:http://localhost/mock-audio-url';

    it('renders player elements', () => {
      render(
        <AudioPlayer 
          url={mockUrl} 
          title="test_recording.mp3" 
          durationSec={45} 
          onClose={mockClose} 
          onDownload={mockDownload} 
          onPlayStateChange={mockPlayState}
        />
      );

      expect(screen.getByText('Tocando: test_recording.mp3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Baixar/i })).toBeInTheDocument();
    });
  });
});
