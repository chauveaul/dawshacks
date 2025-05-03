'use client';

import { useState, useEffect } from 'react';
import { AppleMusicUserData } from '../lib/apple-music';
import MusicDashboard from './MusicDashboard';
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    MusicKit: any;
  }
}

export default function AppleMusicAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [musicKit, setMusicKit] = useState<any>(null);
  const [musicData, setMusicData] = useState<AppleMusicUserData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load the MusicKit JS library
    const script = document.createElement('script');
    script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
    script.async = true;
    
    script.onload = async () => {
      try {
        // Initialize MusicKit
        await initializeMusicKit();
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading MusicKit:', err);
        setError('Failed to load Apple Music. Please try again later.');
        setIsLoading(false);
      }
    };
    
    script.onerror = () => {
      setError('Failed to load Apple Music SDK. Please check your internet connection.');
      setIsLoading(false);
    };
    
    document.body.appendChild(script);
    
    return () => {
      // Cleanup
      document.body.removeChild(script);
    };
  }, []);
  
  const initializeMusicKit = async () => {
    try {
      // Fetch developer token from our backend
      const response = await fetch('/api/apple-music-token');
      
      if (!response.ok) {
        throw new Error('Failed to get developer token');
      }
      
      const { token } = await response.json();
      
      // Configure MusicKit
      const music = await window.MusicKit.configure({
        developerToken: token,
        app: {
          name: 'My Music App',
          build: '1.0.0',
        },
      });
      
      setMusicKit(music);
      
      // Check if user is already authorized
      const isAuthorized = music.isAuthorized;
      setIsAuthenticated(isAuthorized);
      
      if (isAuthorized) {
        await fetchUserData(music.musicUserToken);
      }
    } catch (err) {
      console.error('MusicKit initialization error:', err);
      setError('Failed to initialize Apple Music. Please try again later.');
    }
  };
  
  const handleLogin = async () => {
    try {
      if (!musicKit) return;
      
      // Request authorization
      await musicKit.authorize();
      setIsAuthenticated(true);
      
      // Fetch user data after successful authentication
      await fetchUserData(musicKit.musicUserToken);
    } catch (err) {
      console.error('Authorization error:', err);
      setError('Failed to authorize with Apple Music. Please try again.');
    }
  };
  
  const handleLogout = async () => {
    try {
      if (!musicKit) return;
      
      await musicKit.unauthorize();
      setIsAuthenticated(false);
      setMusicData(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to sign out of Apple Music. Please try again.');
    }
  };
  
  const fetchUserData = async (userToken: string) => {
    try {
      const response = await fetch('/api/apple-music-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userToken }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch music data');
      }
      
      const data = await response.json();
      setMusicData(data);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load your music data. Please try again.');
    }
  };
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading Apple Music...</div>;
  }
  
  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>;
  }
  
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6">
        <h1 className="text-4xl font-bold mb-4">Apple Music</h1>
        <p className="text-xl mb-8">Connect to your Apple Music account to access your music library</p>
        <Button 
          onClick={handleLogin}
          className="px-8 py-6 rounded-full text-lg"
        >
          Connect to Apple Music
        </Button>
      </div>
    );
  }
  
  return <MusicDashboard musicData={musicData} onLogout={handleLogout} />;
}
