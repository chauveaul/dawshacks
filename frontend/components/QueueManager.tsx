'use client';

import { useEffect, useState, useRef } from 'react';

interface QueueItem {
  id: string;
  name: string;
  artist: string;
  artwork: string;
  addedAt: string;
  duration: number;
}

interface RecentNotification {
  id: string;
  timestamp: number;
}

export default function QueueManager() {
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Track recent notifications to prevent duplicates
  const recentNotifications = useRef<RecentNotification[]>([]);
  // Track if component is mounted
  const isMounted = useRef(false);
  // Debounce timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Effect to initialize queue management
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;
    
    // Set mounted state
    isMounted.current = true;
    
    // Setup MusicKit listeners when component mounts
    const setupMusicKitListeners = async () => {
      try {
        // Wait for MusicKit to be available
        let attempts = 0;
        const maxAttempts = 10;
        
        const waitForMusicKit = () => {
          return new Promise<any>((resolve, reject) => {
            const check = () => {
              if ((window as any).MusicKit?.getInstance) {
                resolve((window as any).MusicKit.getInstance());
              } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(check, 500);
              } else {
                reject(new Error('MusicKit not available after multiple attempts'));
              }
            };
            check();
          });
        };
        
        const music = await waitForMusicKit();
        
        // Set initial state
        const currentSong = music.nowPlayingItem;
        if (currentSong) {
          setCurrentSongId(currentSong.id);
          setIsPlaying(music.playbackState === 1); // 1 = playing
        }
        
        // Remove any existing listeners first to prevent duplicates
        try {
          music.removeEventListener('playbackStateDidChange');
          music.removeEventListener('nowPlayingItemDidChange');
        } catch (e) {
          // Ignore errors when removing listeners
        }
        
        // Listen for playback state changes
        music.addEventListener('playbackStateDidChange', (event: any) => {
          if (!isMounted.current) return;
          
          // 0: stopped, 1: playing, 2: paused, 3: interrupted, 4: seeking, etc.
          console.log('Playback state changed:', event.state);
          setIsPlaying(event.state === 1);
          
          // If playback stopped (state = 0), play the next song
          if (event.state === 0) {
            playNextSong();
          }
        });
        
        // Listen for now playing item changes
        music.addEventListener('nowPlayingItemDidChange', (event: any) => {
          if (!isMounted.current) return;
          
          console.log('Now playing item changed:', event.item);
          if (event.item) {
            const newSongId = event.item.id;
            
            // Only update if it's a different song
            if (newSongId !== currentSongId) {
              setCurrentSongId(newSongId);
              
              // When a new song starts playing, notify the backend
              // but only if we haven't recently notified for this song
              if (!hasRecentlyNotified(newSongId)) {
                // Debounce notification
                if (debounceTimer.current) {
                  clearTimeout(debounceTimer.current);
                }
                debounceTimer.current = setTimeout(() => {
                  notifyBackend(event.item);
                }, 500);
              }
            }
          } else {
            setCurrentSongId(null);
          }
        });
        
        // Check if we need to start playing something from the queue
        const queueItems = getQueueFromStorage();
        if (queueItems.length > 0 && !currentSong) {
          playNextSong();
        }
      } catch (error) {
        console.error('Error setting up MusicKit listeners:', error);
      }
    };
    
    setupMusicKitListeners();
    
    // Set up interval to check queue status periodically
    const intervalId = setInterval(checkQueueStatus, 5000);
    
    return () => {
      // Set unmounted state
      isMounted.current = false;
      clearInterval(intervalId);
      
      // Clean up MusicKit listeners
      try {
        const music = (window as any).MusicKit?.getInstance();
        if (music) {
          music.removeEventListener('playbackStateDidChange');
          music.removeEventListener('nowPlayingItemDidChange');
        }
      } catch (error) {
        console.error('Error cleaning up MusicKit listeners:', error);
      }
    };
  }, []);
  
  // Check if we've recently notified the backend about this song
  const hasRecentlyNotified = (songId: string): boolean => {
    const now = Date.now();
    
    // Remove notifications older than 10 seconds
    recentNotifications.current = recentNotifications.current.filter(
      notification => now - notification.timestamp < 10000
    );
    
    // Check if this song ID is in our recent notifications
    return recentNotifications.current.some(notification => notification.id === songId);
  };
  
  // Add a song to our recent notifications
  const addToRecentNotifications = (songId: string): void => {
    recentNotifications.current.push({
      id: songId,
      timestamp: Date.now()
    });
  };
  
  // Get queue items from localStorage
  const getQueueFromStorage = (): QueueItem[] => {
    try {
      const queueString = localStorage.getItem('songQueue') || '[]';
      return JSON.parse(queueString);
    } catch (error) {
      console.error('Error parsing queue from storage:', error);
      return [];
    }
  };
  
  // Save queue items to localStorage
  const saveQueueToStorage = (queue: QueueItem[]): void => {
    try {
      localStorage.setItem('songQueue', JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving queue to storage:', error);
    }
  };
  
  // Remove a song from the queue
  const removeSongFromQueue = (songId: string): void => {
    const queue = getQueueFromStorage();
    const updatedQueue = queue.filter(item => item.id !== songId);
    saveQueueToStorage(updatedQueue);
  };
  
  // Check if we need to play a song from the queue
  const checkQueueStatus = (): void => {
    if (!isMounted.current) return;
    
    try {
      const music = (window as any).MusicKit?.getInstance();
      if (!music) return;
      
      const queue = getQueueFromStorage();
      
      // If nothing is playing and we have songs in the queue, play the next song
      if (queue.length > 0 && !isPlaying && !music.nowPlayingItem) {
        playNextSong();
      }
    } catch (error) {
      console.error('Error checking queue status:', error);
    }
  };
  
  // Play the next song in the queue
  const playNextSong = async (): Promise<void> => {
    if (!isMounted.current) return;
    
    try {
      const music = (window as any).MusicKit?.getInstance();
      if (!music) return;
      
      const queue = getQueueFromStorage();
      if (queue.length === 0) return;
      
      const nextSong = queue[0];
      
      // Check if we've already notified about this song recently
      if (hasRecentlyNotified(nextSong.id)) {
        console.log(`Skipping notification for ${nextSong.name} - already notified recently`);
        // Still play the song, just don't notify again
        await music.setQueue({ song: nextSong.id });
        await music.play();
        removeSongFromQueue(nextSong.id);
        return;
      }
      
      // Set up MusicKit queue and play
      await music.setQueue({ song: nextSong.id });
      await music.play();
      
      console.log(`Playing next song: ${nextSong.name} by ${nextSong.artist}`);
      
      // Notify the backend about the song being played
      await notifyBackend({
        id: nextSong.id,
        attributes: {
          name: nextSong.name,
          artistName: nextSong.artist,
          artwork: { url: nextSong.artwork },
          durationInMillis: nextSong.duration * 1000 // Convert to milliseconds
        }
      });
      
      // Remove the song from our queue once it's playing
      removeSongFromQueue(nextSong.id);
    } catch (error) {
      console.error('Error playing next song:', error);
    }
  };
  
  // Notify the backend that a song is playing
  const notifyBackend = async (item: any): Promise<void> => {
    if (!isMounted.current) return;
    
    if (!item || typeof item !== 'object') {
      console.error('Invalid item passed to notifyBackend:', item);
      return;
    }
    
    try {
      // Extract metadata from the nowPlayingItem, with safe fallbacks
      const songId = item.id || '';
      
      // If no songId, we can't proceed
      if (!songId) {
        console.error('No songId available in the item:', item);
        return;
      }
      
      // Check if we've already notified about this song recently
      if (hasRecentlyNotified(songId)) {
        console.log(`Skipping notification for song ${songId} - already notified recently`);
        return;
      }
      
      // Add this notification to our tracking
      addToRecentNotifications(songId);
      
      // Safely extract other metadata
      const attributes = item.attributes || {};
      const title = attributes.name || 'Unknown Title';
      const artist = attributes.artistName || 'Unknown Artist';
      const duration = Math.floor(((attributes.durationInMillis || 0) / 1000)) || 0; // Convert to seconds
      
      // Send metadata to our backend, without waiting for artwork
      console.log('Notifying backend about now playing song:', {
        songId,
        title,
        artist,
        duration
      });
      
      // Send metadata to the backend without artwork first
      const backendResponse = await fetch('/api/apple-music-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          songId,
          title,
          artist,
          albumPicture: [], // Empty for now
          duration
        }),
      });

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error(`Backend responded with status ${backendResponse.status}: ${errorText}`);
        return;
      }
      
      console.log('Backend notified successfully');
      
      // Try to fetch artwork in the background without blocking
      if (attributes.artwork?.url) {
        getArtworkAndUpdate(songId, attributes.artwork.url, title, artist, duration)
          .catch(err => console.error('Background artwork processing failed:', err));
      }
    } catch (error) {
      console.error('Error in notifyBackend:', error);
    }
  };
  
  // Handle artwork separately to avoid blocking the main notification
  const getArtworkAndUpdate = async (
    songId: string, 
    artworkUrl: string,
    title: string,
    artist: string,
    duration: number
  ): Promise<void> => {
    if (!isMounted.current) return;
    
    try {
      // Format the URL
      const formattedUrl = artworkUrl
        .replace('{w}', '300')
        .replace('{h}', '300');
      
      if (!formattedUrl.startsWith('http')) {
        return;
      }
      
      // Fetch artwork
      const response = await fetch(formattedUrl);
      if (!response.ok) {
        return;
      }
      
      const blob = await response.blob();
      
      // Convert to base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      // Convert to byte array
      const byteCharacters = atob(base64String);
      const albumPictureBase64 = Array.from(byteCharacters).map(char => char.charCodeAt(0));
      
      // Update the backend with artwork - only if we're still mounted
      if (albumPictureBase64.length > 0 && isMounted.current) {
        console.log('Updating backend with artwork');
        
        await fetch('/api/apple-music-queue', {
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
      }
    } catch (error) {
      console.error('Error processing artwork:', error);
      // Don't rethrow - this is a background task
    }
  };
  
  // This is a hidden component that manages the queue in the background
  return null;
}
