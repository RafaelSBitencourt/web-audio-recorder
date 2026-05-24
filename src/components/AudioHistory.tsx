import { useState } from 'react';
import { Play, Trash2, Calendar, FileAudio, ChevronLeft, ChevronRight, HardDrive, Clock, Download } from 'lucide-react';
import type { AudioMetadata } from '../lib/schemas';

interface AudioHistoryProps {
  audios: AudioMetadata[];
  isLoading: boolean;
  activeAudioId: string | null;
  onSelectAudio: (audio: AudioMetadata) => void;
  onDeleteAudio: (id: string, bucketPath: string) => void;
  onDownloadAudio: (audio: AudioMetadata) => void;
}

const ITEMS_PER_PAGE = 5;

export function AudioHistory({ 
  audios, 
  isLoading, 
  activeAudioId, 
  onSelectAudio, 
  onDeleteAudio, 
  onDownloadAudio 
}: AudioHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Formatting helpers
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(audios.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAudios = audios.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  if (isLoading) {
    return (
      <div className="glass-card history-panel">
        <div className="panel-header">
          <h2 className="panel-title">Seus Áudios</h2>
        </div>
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card history-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Seus Áudios</h2>
          <p className="panel-subtitle">Total de {audios.length} gravações salva{audios.length === 1 ? 'da' : 'das'}</p>
        </div>
      </div>

      {audios.length === 0 ? (
        <div className="empty-state">
          <FileAudio className="empty-icon" />
          <h3>Nenhuma gravação encontrada</h3>
          <p>Clique no botão REC ao lado para iniciar sua primeira gravação.</p>
        </div>
      ) : (
        <>
          <div className="audio-list">
            {paginatedAudios.map((audio) => {
              const isActive = activeAudioId === audio.id;
              // Extract filename from bucket path (e.g. user_id/timestamp_name.mp3 -> name.mp3)
              const pathParts = audio.bucket_path.split('/');
              const fileFullName = pathParts[pathParts.length - 1];
              // Strip timestamp prefix if possible (digits followed by underscore)
              const title = fileFullName.replace(/^\d+_/, '');

              return (
                <div 
                  key={audio.id} 
                  className={`audio-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectAudio(audio)}
                >
                  <div className="audio-item-info">
                    <span className="audio-item-title" title={title}>{title}</span>
                    <div className="audio-item-meta">
                      <span className="audio-meta-item" title="Data de Gravação">
                        <Calendar size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
                        {formatDate(audio.created_at)}
                      </span>
                      <span className="audio-meta-item" title="Tamanho do Arquivo">
                        <HardDrive size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
                        {formatSize(audio.size_bytes)}
                      </span>
                      <span className="audio-meta-item" title="Duração">
                        <Clock size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
                        {formatDuration(audio.duration_sec)}
                      </span>
                    </div>
                  </div>
                  <div className="audio-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="action-icon-btn" 
                      onClick={() => onSelectAudio(audio)}
                      title="Reproduzir Áudio"
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                    <button 
                      className="action-icon-btn" 
                      onClick={() => onDownloadAudio(audio)}
                      title="Baixar Áudio"
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      className="action-icon-btn btn-delete" 
                      onClick={() => onDeleteAudio(audio.id, audio.bucket_path)}
                      title="Excluir Gravação"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--ui-border)' }}>
              <button 
                className="control-btn" 
                onClick={handlePrevPage} 
                disabled={currentPage === 1}
                style={{ opacity: currentPage === 1 ? 0.5 : 1, padding: '8px 16px' }}
              >
                <ChevronLeft size={16} />
                <span>Anterior</span>
              </button>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Página {currentPage} de {totalPages}
              </span>
              <button 
                className="control-btn" 
                onClick={handleNextPage} 
                disabled={currentPage === totalPages}
                style={{ opacity: currentPage === totalPages ? 0.5 : 1, padding: '8px 16px' }}
              >
                <span>Próxima</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AudioHistory;
