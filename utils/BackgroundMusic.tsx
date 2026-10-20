import React, {useEffect, useRef, useState} from 'react';

export interface BackgroundMusicProps {
  readonly url: string;
  readonly isPlaying: boolean;
  readonly isMuted?: boolean;
  readonly volume?: number;
}

export function BackgroundMusic({
  url,
  isPlaying,
  isMuted = false,
  volume = 0.25,
}: BackgroundMusicProps): React.ReactElement | null {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [isMuted, volume]);

  useEffect(() => {
    if (!audioRef.current || !url) return;
    if (isPlaying && !isMuted) {
      void audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isMuted, url]);

  if (!url) return null;

  return (
    <audio
      ref={audioRef}
      src={url}
      loop
      autoPlay={isPlaying && !isMuted}
      style={{display: 'none'}}
    />
  );
}

export default BackgroundMusic;
