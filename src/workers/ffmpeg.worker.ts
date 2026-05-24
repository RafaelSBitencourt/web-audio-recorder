import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpegInstance(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg Worker Log]:', message);
  });

  ffmpeg.on('progress', ({ progress }) => {
    // progress is a number from 0 to 1
    self.postMessage({ type: 'progress', progress: Math.round(progress * 100) });
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, blob } = event.data;

  if (type === 'load') {
    try {
      await getFFmpegInstance();
      self.postMessage({ type: 'loaded' });
    } catch (error) {
      console.error('[FFmpeg Worker] Error loading FFmpeg:', error);
      self.postMessage({ 
        type: 'error', 
        error: `Falha ao carregar FFmpeg: ${(error as Error).message}` 
      });
    }
  }

  if (type === 'transcode') {
    try {
      const ffmpeg = await getFFmpegInstance();
      
      if (!blob) {
        throw new Error('Nenhum dado de áudio fornecido para conversão.');
      }

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // WebM/OGG/MP4 depending on browser native format
      const mimeType = blob.type || 'audio/webm';
      let extension = 'webm';
      if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        extension = 'mp4';
      } else if (mimeType.includes('ogg')) {
        extension = 'ogg';
      } else if (mimeType.includes('wav')) {
        extension = 'wav';
      }

      const inputName = `input.${extension}`;
      const outputName = 'output.mp3';

      // Write raw file to FFmpeg Virtual File System (MEMFS)
      await ffmpeg.writeFile(inputName, uint8);

      // Run transcoding command
      // -i input -acodec libmp3lame -aq 2 (VBR high quality) or -b:a 128k (CBR)
      await ffmpeg.exec([
        '-i', inputName,
        '-codec:a', 'libmp3lame',
        '-b:a', '128k',
        outputName
      ]);

      // Read processed file
      const outputData = await ffmpeg.readFile(outputName);
      
      // Clean up MEMFS to save memory
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      // Convert result to MP3 blob and send back
      const mp3Blob = new Blob([outputData as any], { type: 'audio/mp3' });
      self.postMessage({ type: 'success', blob: mp3Blob });

    } catch (error) {
      console.error('[FFmpeg Worker] Transcoding failed:', error);
      self.postMessage({ 
        type: 'error', 
        error: `Falha na conversão para MP3: ${(error as Error).message}` 
      });
    }
  }
};
