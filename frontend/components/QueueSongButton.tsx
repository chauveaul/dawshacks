'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from 'lucide-react';

interface QueueSongButtonProps {
  songId: string;
  title: string;
  artist: string;
  albumArtwork?: string;
  duration: number;
  className?: string;
  iconOnly?: boolean;
}

export default function QueueSongButton({
  songId,
  title,
  artist,
  albumArtwork,
  duration,
  className = "",
  iconOnly = false
}: QueueSongButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const addToQueueAndPlay = async () => {
    try {
      setIsLoading(true);

      // 1. Get MusicKit instance
      const music = (window as any).MusicKit?.getInstance();
      if (!music) {
        throw new Error('MusicKit is not initialized');
      }
      
      // 2. Fetch album artwork as base64 if available
      let albumPictureBase64: number[] = [];
      if (albumArtwork) {
        try {
          const response = await fetch(albumArtwork);
          const blob = await response.blob();
          
          // Convert blob to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              // Remove data URL prefix (data:image/jpeg;base64,)
              const base64Result = reader.result as string;
              const base64String = base64Result.split(',')[1];
              resolve(base64String);
            };
          });
          reader.readAsDataURL(blob);
          
          // Convert base64 string to byte array
          const base64String = await base64Promise;
          const byteCharacters = atob(base64String);
          albumPictureBase64 = Array.from(byteCharacters).map(char => char.charCodeAt(0));
        } catch (error) {
          console.error('Failed to process album artwork:', error);
          // Continue without album artwork
        }
      }

      // 3. Send metadata to our backend
      const backendResponse = await fetch('/api/apple-music-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          songId,
          title,
          artist,
          albumPicture: albumPictureBase64,
          duration
        }),
      });

      if (!backendResponse.ok) {
        throw new Error('Failed to queue song on backend');
      }

      // 4. Add to Apple Music queue and play
      await music.setQueue({ song: songId });
      await music.play();
      
      setIsPlaying(true);

      // Listen for playback state change
      const unsubscribe = music.addEventListener('playbackStateDidChange', (event: any) => {
        // MusicKit playback states: 0: stopped, 1: playing, 2: paused, 3: interrupted, 4: seeking, etc.
        if (event.state === 0) { // stopped
          setIsPlaying(false);
          unsubscribe(); // Clean up event listener when song is finished
        }
      });

    } catch (error) {
      console.error('Error adding song to queue:', error);
      alert('Failed to add song to queue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={addToQueueAndPlay}
      disabled={isLoading}
      className={`${className} ${isPlaying ? 'bg-primary/70' : ''}`}
      size={iconOnly ? "icon" : "default"}
    >
      {isLoading ? (
        <Loader2 className={`h-5 w-5 animate-spin ${!iconOnly ? 'mr-2' : ''}`} />
      ) : (
        <Play className={`h-5 w-5 ${isPlaying ? 'fill-white' : 'fill-current'} ${!iconOnly ? 'mr-2' : ''}`} />
      )}
      {!iconOnly && (isPlaying ? 'Playing...' : 'Play')}
    </Button>
  );
}
