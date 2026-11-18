import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export default function VoiceMessagePlayer({
  audioUrl,
  duration,
}: {
  audioUrl: string;
  duration?: number;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        padding: '5px 11px',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        marginBottom: 6,
        userSelect: 'none',
        maxWidth: '100%',
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isPlaying ? <Pause size={12} /> : <Play size={12} style={{ marginLeft: 2 }} />}
      </button>

      {/* Simulated waveform bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
        {[4, 8, 14, 10, 16, 7, 12, 18, 9, 13, 6, 11].map((h, i) => (
          <div
            key={i}
            style={{
              width: 2.5,
              height: `${Math.round(h * 0.8)}px`,
              borderRadius: 1,
              background: isPlaying ? 'var(--accent-light)' : 'rgba(255, 255, 255, 0.4)',
              transition: 'height 0.15s ease',
            }}
          />
        ))}
      </div>

      <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.85)' }}>
        {formatSecs(currentTime || duration || 0)}
      </span>
    </div>
  );
}
