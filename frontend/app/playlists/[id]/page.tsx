'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Music, Search, User, Loader2, Plus, Clock, ListMusic, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchResult } from '@/lib/apple-music';
import { toast } from '@/components/ui/use-toast';

interface QueueItem {
  id: string;
  name: string;
  artist: string;
  artwork: string;
  addedAt: string;
}

interface PlaylistDetails {
  id: string;
  attributes: {
    name: string;
    description?: {
      standard: string;
    };
    artwork?: {
      url: string;
    };
    trackCount?: number;
    dateAdded?: string;
  };
  tracks: Array<{
    id: string;
    attributes: {
      name: string;
      artistName: string;
      albumName?: string;
      artwork?: {
        url: string;
      };
      durationInMillis?: number;
    }
  }>;
}

export default function PlaylistDetails() {
  // Use the useParams hook to get the route parameters
  const params = useParams();
  const playlistId = params.id as string;
  const router = useRouter();
  
  const [playlistData, setPlaylistData] = useState<PlaylistDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // For the search bar
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPlaylistDetails = async () => {
      try {
        setIsLoading(true);
        
        // Check if MusicKit is available in the window object
        if (!(window as any).MusicKit) {
          console.warn('MusicKit JS is not available, redirecting to authentication');
          router.push('/');
          return;
        }
        
        // Check if MusicKit instance can be retrieved
        let musicKitInstance;
        try {
          musicKitInstance = (window as any).MusicKit.getInstance();
        } catch (error) {
          console.warn('MusicKit is not initialized, redirecting to authentication');
          router.push('/');
          return;
        }
        
        // Check if user is authenticated
        const userToken = musicKitInstance?.musicUserToken;
        if (!userToken) {
          console.warn('User is not authenticated, redirecting to authentication');
          router.push('/');
          return;
        }
        
        // Fetch playlist details from Apple Music API via our server endpoint
        const response = await fetch('/api/apple-music-playlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: playlistId, userToken }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch playlist details');
        }
        
        const data = await response.json();
        setPlaylistData(data);
      } catch (err) {
        console.error('Error fetching playlist details:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPlaylistDetails();
  }, [playlistId, router]);
  
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
    if (!query || query.trim().length === 0) return;
    
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
    router.push(`/songs/${result.id}`);
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
  
  // Format the artwork URL
  const formatArtworkUrl = (url: string | undefined): string => {
    if (!url) return '';
    
    try {
      // Handle URLs with placeholders
      if (url.includes('{w}') && url.includes('{h}')) {
        return url.replace('{w}', '600').replace('{h}', '600');
      }
      
      return url;
    } catch (error) {
      console.error('Error formatting artwork URL:', error);
      return '';
    }
  };
  
  // Format duration from milliseconds to minutes:seconds
  const formatDuration = (ms?: number): string => {
    if (!ms) return '--:--';
    
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  // Handle song click
  const handleSongClick = (songId: string) => {
    router.push(`/songs/${songId}`);
  };

  // Add all songs to queue
  const addAllToQueue = async () => {
    if (!playlistData) return;

    try {
      const musicKitInstance = (window as any).MusicKit?.getInstance();
      const userToken = musicKitInstance?.musicUserToken;

      if (!userToken) {
        console.error('No user token available for adding to queue');
        return;
      }

      const existingQueue = JSON.parse(localStorage.getItem('songQueue') || '[]');
      
      // Get song details for queue
      const songsToAdd = playlistData.tracks.map(track => ({
        id: track.id,
        name: track.attributes.name,
        artist: track.attributes.artistName,
        artwork: track.attributes.artwork?.url || '',
        addedAt: new Date().toISOString()
      }));
      
      // Add only songs that aren't already in the queue
      const newQueue = [...existingQueue];
      let addedCount = 0;
      
      songsToAdd.forEach(song => {
        if (!existingQueue.some((item: QueueItem) => item.id === song.id)) {
          newQueue.push(song);
          addedCount++;
        }
      });
      
      localStorage.setItem('songQueue', JSON.stringify(newQueue));

      // Display toast notification
      toast({
        title: "Added to Queue",
        description: `${addedCount} song${addedCount !== 1 ? 's' : ''} added to download queue`,
        variant: "default",
      });
    } catch (error) {
      console.error('Error adding to queue:', error);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 bg-background">
      {/* Top bar with search and user profile - Similar to dashboard but with back button */}
      <div className="flex items-center gap-3 mb-8">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        
        <div className="flex-1 relative">
          <form onSubmit={handleSearch} className="relative group">
            <div className={`flex items-center px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full transition-all duration-300 ${isSearchFocused ? 'ring-1 ring-zinc-400 dark:ring-zinc-600' : ''}`}>
              {isSearching ? (
                <Loader2 className="w-5 h-5 text-zinc-400 dark:text-zinc-500 animate-spin" />
              ) : (
                <Search className={`w-5 h-5 transition-colors duration-300 ${isSearchFocused ? 'text-primary' : 'text-zinc-400 dark:text-zinc-500'}`} />
              )}
              <input
                type="text"
                placeholder="Search Apple Music"
                className="w-full ml-2 bg-transparent border-none text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-0 text-foreground"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onFocus={() => {
                  setIsSearchFocused(true);
                  if (searchResults.length > 0) {
                    setShowResults(true);
                  }
                }}
                onBlur={() => setIsSearchFocused(false)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="p-1 ml-2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          </form>
          
          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div 
              ref={searchResultsRef}
              className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden max-h-96"
            >
              <div className="p-1">
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
        
        <Button 
          variant="ghost"
          size="icon"
          className="rounded-full flex items-center justify-center"
          onClick={() => router.push('/queue')}
        >
          <ListMusic className="h-5 w-5" />
        </Button>
        
        <button 
          className="rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0 w-10 h-10 overflow-hidden relative group"
          onClick={() => router.push('/')}
        >
          <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary/70" />
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-full"></div>
        </button>
      </div>
      
      {/* Main content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <div className="text-red-500 mb-4 text-5xl">😕</div>
          <h2 className="text-2xl font-bold mb-2">Couldn't Load Playlist</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/')}>Return to Dashboard</Button>
        </div>
      ) : playlistData ? (
        <div className="flex flex-col">
          {/* Playlist header */}
          <div className="flex flex-col md:flex-row gap-8 mb-10">
            <div className="flex-shrink-0">
              <div className="relative w-48 h-48 md:w-60 md:h-60 rounded-lg overflow-hidden shadow-xl">
                {playlistData.attributes?.artwork?.url ? (
                  <Image
                    src={formatArtworkUrl(playlistData.attributes.artwork.url)}
                    alt={playlistData.attributes.name}
                    fill
                    priority
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                    <Music className="h-24 w-24 text-white/70" />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{playlistData.attributes.name}</h1>
                {playlistData.attributes.description && (
                  <p className="text-muted-foreground mb-4">{playlistData.attributes.description.standard}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {playlistData.attributes.trackCount || playlistData.tracks.length} songs
                </p>
              </div>
              
              <div className="flex gap-4 mt-6">
                <Button 
                  className="rounded-full px-8 group" 
                  size="lg"
                  onClick={addAllToQueue}
                >
                  <Plus className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" /> 
                  Add All to Queue
                </Button>
              </div>
            </div>
          </div>
          
          {/* Songs table */}
          <div className="mt-6">
            <div className="border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-2">
              <div className="grid grid-cols-12 gap-4 px-4 text-sm font-medium text-muted-foreground">
                <div className="col-span-1">#</div>
                <div className="col-span-6">TITLE</div>
                <div className="col-span-4 hidden md:block">ALBUM</div>
                <div className="col-span-1 text-right"><Clock className="w-4 h-4 inline-block" /></div>
              </div>
            </div>
            
            <div className="space-y-1">
              {playlistData.tracks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  This playlist is empty
                </div>
              ) : (
                playlistData.tracks.map((track, index) => (
                  <div 
                    key={track.id} 
                    className="grid grid-cols-12 gap-4 p-2 px-4 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 items-center cursor-pointer group transition-colors duration-300"
                    onClick={() => handleSongClick(track.id)}
                  >
                    <div className="col-span-1 text-muted-foreground text-sm">{index + 1}</div>
                    <div className="col-span-6 flex items-center gap-3">
                      <div className="w-10 h-10 relative flex-shrink-0 bg-zinc-200 dark:bg-zinc-700 rounded overflow-hidden transition-all duration-300 ease-in-out transform group-hover:scale-[1.05] group-hover:shadow-md">
                        {track.attributes?.artwork?.url ? (
                          <>
                            <Image
                              src={formatArtworkUrl(track.attributes.artwork.url)}
                              alt={track.attributes.name}
                              fill
                              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="rounded-full h-7 w-7 bg-white/90 flex items-center justify-center text-black transform scale-0 group-hover:scale-100 transition-transform duration-300 ease-out">
                                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Music className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                      </div>
                      <div className="transition-transform duration-300 group-hover:translate-x-1">
                        <p className="font-medium text-sm line-clamp-1">{track.attributes.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 group-hover:text-primary transition-colors duration-300">{track.attributes.artistName}</p>
                      </div>
                    </div>
                    <div className="col-span-4 hidden md:block">
                      <p className="text-sm text-muted-foreground line-clamp-1">{track.attributes.albumName || '-'}</p>
                    </div>
                    <div className="col-span-1 text-right text-muted-foreground text-sm">
                      {formatDuration(track.attributes.durationInMillis)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">No playlist information available</p>
        </div>
      )}
    </div>
  );
}
