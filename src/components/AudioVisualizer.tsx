import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  isPlaying: boolean;
  theme: 'light' | 'dark';
}

export function AudioVisualizer({ analyserNode, isRecording, isPlaying, theme }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas based on client rect
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    
    // Listen for resize
    window.addEventListener('resize', resizeCanvas);

    // Setup visualizer variables
    let bufferLength = analyserNode ? analyserNode.frequencyBinCount : 0;
    let dataArray = analyserNode ? new Uint8Array(bufferLength) : new Uint8Array(0);

    let phase = 0; // used for simulated waves

    const draw = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Get color tokens from computed CSS variables
      const rootStyle = getComputedStyle(document.documentElement);
      const accentColor = rootStyle.getPropertyValue('--ui-accent').trim() || '#20dad8';
      const actionColor = rootStyle.getPropertyValue('--ui-action').trim() || '#b61139';

      if (isRecording && analyserNode) {
        // ------------------------------------
        // LIVE MICROPHONE VISUALIZATION
        // ------------------------------------
        analyserNode.getByteFrequencyData(dataArray);

        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        
        const barWidth = (width / bufferLength) * 2.2;
        let barHeight;
        let x = 0;

        // Draw double sided frequency bars (mirror center)
        for (let i = 0; i < bufferLength; i++) {
          // Normalize value
          barHeight = (dataArray[i] / 255) * (height * 0.7);

          // Create gradient for recording (red to orange)
          const grad = ctx.createLinearGradient(0, height / 2 - barHeight / 2, 0, height / 2 + barHeight / 2);
          grad.addColorStop(0, actionColor);
          grad.addColorStop(0.5, '#f59e0b');
          grad.addColorStop(1, actionColor);

          ctx.fillStyle = grad;

          // Mirror the visualizer
          const centeredBarHeight = Math.max(4, barHeight); // minimum height of 4px for aesthetic
          ctx.fillRect(x, height / 2 - centeredBarHeight / 2, barWidth - 1.5, centeredBarHeight);
          
          x += barWidth;
        }

      } else if (isPlaying) {
        // ------------------------------------
        // SIMULATED WAVE PLAYBACK (ELEGANT WAVE)
        // ------------------------------------
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = accentColor;

        // Draw multiple overlapping sine waves for a premium "Siri-like" or "Sound-like" effect
        const waveCount = 3;
        for (let w = 0; w < waveCount; w++) {
          ctx.beginPath();
          ctx.lineWidth = w === 0 ? 3 : 1;
          
          // Outer waves are more transparent
          ctx.strokeStyle = w === 0 
            ? accentColor 
            : w === 1 
              ? `${accentColor}80` 
              : `${accentColor}33`;

          const amplitude = (height / 2.5) * (w === 0 ? 0.8 : w === 1 ? 0.5 : 0.3);
          const frequency = 0.015 * (w + 1);
          
          phase += 0.01; // increment animation state

          for (let i = 0; i < width; i += 2) {
            // Apply a window function (Sinc/Gaussian) to taper the wave at the edges
            const edgeTaper = Math.sin((i / width) * Math.PI);
            const y = height / 2 + Math.sin(i * frequency + phase * (w === 0 ? 2 : 1.3)) * amplitude * edgeTaper;
            
            if (i === 0) {
              ctx.moveTo(i, y);
            } else {
              ctx.lineTo(i, y);
            }
          }
          ctx.stroke();
        }
      } else {
        // ------------------------------------
        // IDLE STATE (FLAT DECORATIVE WAVE)
        // ------------------------------------
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.9)';

        // Draw a static wave
        for (let i = 0; i < width; i += 2) {
          const edgeTaper = Math.sin((i / width) * Math.PI);
          const y = height / 2 + Math.sin(i * 0.02) * 5 * edgeTaper;
          
          if (i === 0) {
            ctx.moveTo(i, y);
          } else {
            ctx.lineTo(i, y);
          }
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserNode, isRecording, isPlaying, theme]);

  return (
    <div className="visualizer-wrapper">
      <canvas ref={canvasRef} className="visualizer-canvas" />
    </div>
  );
}

export default AudioVisualizer;
