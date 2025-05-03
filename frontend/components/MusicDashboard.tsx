'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppleMusicUserData, SearchResult } from '../lib/apple-music';
import { ChevronLeft, ChevronRight, Search, User, Music, Play, Loader2, ListMusic } from 'lucide-react';
import { BlurFade } from "@/components/magicui/blur-fade";

interface MusicDashboardProps {
  musicData: AppleMusicUserData | null;
  onLogout: () => void;
}

export default function MusicDashboard({ musicData, onLogout }: MusicDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Function to format Apple Music artwork URL
  const formatArtworkUrl = (url: string | undefined): string => {
    if (!url) return '';
    
    try {
      // Handle URLs with placeholders
      if (url.includes('{w}') && url.includes('{h}')) {
        return url.replace('{w}', '300').replace('{h}', '300');
      }
      
      // Handle URLs that already have dimensions
      return url;
    } catch (error) {
      console.error('Error formatting artwork URL:', error);
      return '';
    }
  };

  // Function to handle search input changes with debounce
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.trim().length === 0) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    
    // Set a new timeout for the search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300); // 300ms debounce
  };
  
  // Function to perform the search
  const performSearch = async (query: string) => {
    if (!query || query.trim().length === 0 || !musicData) return;
    
    try {
      setIsSearching(true);
      
      // Get the user's music token from the MusicKit instance
      const musicKitInstance = (window as any).MusicKit?.getInstance();
      const userToken = musicKitInstance?.musicUserToken;
      
      if (!userToken) {
        console.error('No user token available for search');
        return;
      }
      
      // Call our search API
      const response = await fetch('/api/apple-music-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          userToken,
          types: ['songs'],
          limit: 5
        }),
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setSearchResults(data.songs || []);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching Apple Music:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Function to handle clicking a search result
  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    // Navigate to the song details page
    router.push(`/songs/${result.id}`);
  };
  
  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };
  
  // Close the search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!musicData) {
    return <div className="p-8">Loading your music data...</div>;
  }

  // Function to render recently played tracks
  const renderRecentlyPlayed = () => {
    if (!musicData.recentlyPlayed || musicData.recentlyPlayed.length === 0) {
      return <div className="text-center p-8">No recently played tracks</div>;
    }

    // Only take the first 5 items
    const recentTracks = musicData.recentlyPlayed.slice(0, 5);

    return (
      <div className="grid grid-cols-5 gap-6">
        {recentTracks.map((item: any, index: number) => (
          <div 
            key={index} 
            className="cursor-pointer"
            onClick={() => router.push(`/songs/${item.id}`)}
          >
            <BlurFade delay={index * 0.1} direction={index % 2 === 0 ? "right" : "left"} inView>
              <div className="flex flex-col gap-2 group">
                <div className="aspect-square relative bg-muted rounded-md overflow-hidden group-hover:shadow-lg transition-all duration-300 ease-in-out transform group-hover:scale-[1.02]">
                  {item.attributes?.artwork?.url ? (
                    <>
                      <Image 
                        src={formatArtworkUrl(item.attributes.artwork.url)}
                        alt={item.attributes?.name || 'Album artwork'}
                        fill
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        onError={(e) => {
                          // Use a fallback for image loading errors
                          const target = e.target as HTMLImageElement;
                          const parent = target.parentNode as HTMLDivElement;
                          target.style.display = 'none';
                          
                          // Create a fallback element
                          const fallback = document.createElement('div');
                          fallback.className = 'w-full h-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-800';
                          
                          // Add a music icon
                          const icon = document.createElement('div');
                          icon.className = 'text-zinc-400';
                          icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
                          
                          fallback.appendChild(icon);
                          parent.appendChild(fallback);
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button size="icon" className="rounded-full h-12 w-12 bg-white/90 hover:bg-white text-black shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 ease-out">
                          <Play className="h-5 w-5 fill-current ml-0.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Music className="w-12 h-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col transition-transform duration-300 group-hover:translate-x-1">
                  <h3 className="font-medium text-sm line-clamp-1">{item.attributes?.name || 'Unknown Track'}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1 group-hover:text-primary transition-colors duration-300">
                    {item.attributes?.artistName || 'Unknown Artist'}
                  </p>
                </div>
              </div>
            </BlurFade>
          </div>
        ))}
      </div>
    );
  };

  // Function to render playlists
  const renderPlaylists = () => {
    if (!musicData.playlists || musicData.playlists.length === 0) {
      return <div className="text-center p-8">No playlists found</div>;
    }

    // Only take the first 5 items
    const userPlaylists = musicData.playlists.slice(0, 5);

    return (
      <div className="grid grid-cols-5 gap-6">
        {userPlaylists.map((playlist: any, index: number) => (
          <div 
            key={index} 
            className="cursor-pointer"
            onClick={() => router.push(`/playlists/${playlist.id}`)}
          >
            <BlurFade delay={index * 0.1} direction={index % 2 === 0 ? "right" : "left"} inView>
              <div className="flex flex-col gap-2 group">
                <div className="aspect-square relative bg-muted rounded-md overflow-hidden group-hover:shadow-lg transition-all duration-300 ease-in-out transform group-hover:scale-[1.02]">
                  {playlist.attributes?.artwork?.url ? (
                    <>
                      <Image 
                        src={formatArtworkUrl(playlist.attributes.artwork.url)}
                        alt={playlist.attributes?.name || 'Playlist artwork'}
                        fill
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        onError={(e) => {
                          // Use a fallback for image loading errors
                          const target = e.target as HTMLImageElement;
                          target.onerror = null; // Prevent infinite loop
                          target.style.display = 'none'; // Hide the img tag
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-full h-full flex items-center justify-center bg-primary/10';
                            
                            const icon = document.createElement('div');
                            icon.className = 'text-primary/50';
                            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/></svg>';
                            
                            fallback.appendChild(icon);
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button size="icon" className="rounded-full h-12 w-12 bg-white/90 hover:bg-white text-black shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 ease-out">
                          <Play className="h-5 w-5 fill-current ml-0.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Music className="w-12 h-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col transition-transform duration-300 group-hover:translate-x-1">
                  <h3 className="font-medium text-sm line-clamp-1">{playlist.attributes?.name || 'Unnamed Playlist'}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1 group-hover:text-primary transition-colors duration-300">
                    {playlist.attributes?.description?.standard || `${playlist.attributes?.trackCount || 0} tracks`}
                  </p>
                </div>
              </div>
            </BlurFade>
          </div>
        ))}
      </div>
    );
  };

  // Get user profile picture URL
  const profilePicUrl = musicData.userProfile?.profilePicture;
  
  // Format the profile pic URL if it exists
  const formattedProfilePicUrl = profilePicUrl 
    ? formatArtworkUrl(profilePicUrl)
    : '';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 bg-background">
      {/* Top bar with search and user profile */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 relative">
          <form onSubmit={handleSearch} className="relative group">
            <Input
              type="text"
              placeholder="Search Apple Music..."
              className="w-full bg-zinc-100/50 dark:bg-zinc-800/50 border-none pl-10 pr-4 py-2 rounded-full"
              value={searchQuery}
              onChange={handleSearchInputChange}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </form>
          
          {showResults && searchResults.length > 0 && (
            <div 
              ref={searchResultsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden z-10 max-h-[70vh] overflow-y-auto"
            >
              <div className="p-2 space-y-1">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="w-10 h-10 relative flex-shrink-0 bg-zinc-200 dark:bg-zinc-700 rounded-md overflow-hidden">
                      {result.attributes?.artwork?.url ? (
                        <Image
                          src={formatArtworkUrl(result.attributes.artwork.url)}
                          alt={result.attributes.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Music className="w-5 h-5 text-zinc-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{result.attributes.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                        {result.attributes.artistName}
                      </p>
                    </div>
                    <Play className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <button 
          className="rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0 w-10 h-10 overflow-hidden relative group"
          onClick={() => router.push('/queue')}
        >
          <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
            <ListMusic className="h-5 w-5 text-primary/70" />
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-full"></div>
        </button>
        
        <button 
          className="rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0 w-10 h-10 overflow-hidden relative group"
          onClick={onLogout}
        >
          {formattedProfilePicUrl ? (
            <Image 
              src={formattedProfilePicUrl} 
              alt="User Profile" 
              fill 
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary/70" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-full"></div>
        </button>
      </div>

      {/* Image slider section */}
      <div className="w-full rounded-xl mb-12 h-72 relative overflow-hidden">
        <Image
          src="/brunomars_banner.jpg"
          alt="Bruno Mars Banner"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Pagination dots */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {[1, 2, 3, 4].map((dot, i) => (
            <div key={dot} className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/50'}`}></div>
          ))}
        </div>
      </div>

      {/* Recently played section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Recently Played</h2>
        {renderRecentlyPlayed()}
      </div>

      {/* Playlists section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Your Playlists</h2>
        {renderPlaylists()}
      </div>
    </div>
  );
}
