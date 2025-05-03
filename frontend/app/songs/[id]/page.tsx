'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Music, 
  Search, 
  User, 
  Clock, 
  ListMusic, 
  Loader2, 
  Play,
  Plus,
  Check,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchResult } from '@/lib/apple-music';
import { toast } from '@/components/ui/use-toast';

interface SongDetails {
  id: string;
  attributes: {
    name: string;
    artistName: string;
    albumName?: string;
    artwork?: {
      url: string;
    };
    genreNames?: string[];
    releaseDate?: string;
    durationInMillis?: number;
  };
}

export default function SongDetails() {
  // Use the useParams hook to get the route parameters
  const params = useParams();
  const songId = params.id as string;
  const router = useRouter();
  
  const [songData, setSongData] = useState<SongDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);
  const [isInQueue, setIsInQueue] = useState(false);
  
  // For the search bar
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSongDetails = async () => {
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
        
        // Fetch song details from Apple Music API via our server endpoint
        const response = await fetch('/api/apple-music-song', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: songId, userToken }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch song details');
        }
        
        const data = await response.json();
        setSongData(data);
      } catch (err) {
        console.error('Error fetching song details:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSongDetails();
  }, [songId, router]);
  
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
    // Navigate to the song details page
    if (result.id === songId) {
      // If it's the same song, just close the search results
      return;
    }
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
  const formatArtworkUrl = (url: string): string => {
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

  // Function to handle adding song to queue
  const addToQueue = async () => {
    if (!songData) return;
    
    try {
      setIsAddingToQueue(true);
      
      // Simulate adding to queue (in real app, this would communicate with a server)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if song is already in queue using localStorage
      const queueString = localStorage.getItem('songQueue') || '[]';
      const queue = JSON.parse(queueString);
      
      // Check if song is already in queue
      if (!queue.some((item: any) => item.id === songData.id)) {
        // Add song to queue
        const newQueue = [...queue, {
          id: songData.id,
          name: songData.attributes.name,
          artist: songData.attributes.artistName,
          artwork: songData.attributes?.artwork?.url || '',
          addedAt: new Date().toISOString()
        }];
        
        // Save to localStorage
        localStorage.setItem('songQueue', JSON.stringify(newQueue));
        
        // Show success message
        toast({
          title: "Added to Queue",
          description: `${songData.attributes.name} has been added to your download queue.`,
          duration: 3000,
        });
        
        setIsInQueue(true);
      } else {
        // Show already in queue message
        toast({
          title: "Already in Queue",
          description: `${songData.attributes.name} is already in your download queue.`,
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      toast({
        title: "Failed to Add",
        description: "There was a problem adding this song to your queue.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsAddingToQueue(false);
    }
  };
  
  // Check if song is already in queue on load
  useEffect(() => {
    if (songData) {
      const queueString = localStorage.getItem('songQueue') || '[]';
      const queue = JSON.parse(queueString);
      setIsInQueue(queue.some((item: any) => item.id === songData.id));
    }
  }, [songData]);

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
                    className={`flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${result.id === songId ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
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
          <h2 className="text-2xl font-bold mb-2">Couldn't Load Song</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/')}>Return to Dashboard</Button>
        </div>
      ) : songData ? (
        <div className="flex flex-col md:flex-row gap-8 md:gap-16">
          <div className="flex-shrink-0">
            <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-lg overflow-hidden shadow-xl group hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:scale-[1.01]">
              {songData.attributes?.artwork?.url ? (
                <>
                  <Image
                    src={formatArtworkUrl(songData.attributes.artwork.url)}
                    alt={songData.attributes.name}
                    fill
                    priority
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="rounded-full h-16 w-16 bg-white/90 flex items-center justify-center text-black transform scale-0 group-hover:scale-100 transition-transform duration-300 ease-out">
                      <Play className="h-7 w-7 fill-current ml-0.5" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Music className="h-24 w-24 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{songData.attributes.name}</h1>
            <h2 className="text-xl md:text-2xl text-muted-foreground mb-6">{songData.attributes.artistName}</h2>
            
            <div className="flex space-x-4 mb-8">
              <Button 
                className="gap-2 px-4 rounded-full" 
                onClick={addToQueue}
                disabled={isAddingToQueue}
              >
                {isAddingToQueue ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : isInQueue ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>In Download Queue</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Add to Queue</span>
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                className="gap-2 px-4 rounded-full"
                onClick={() => router.push('/queue')}
              >
                <Play className="h-4 w-4" />
                <span>View Queue</span>
              </Button>
            </div>
            
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {songData.attributes.albumName && (
                <>
                  <dt className="text-sm font-medium text-muted-foreground">Album</dt>
                  <dd className="text-sm">{songData.attributes.albumName}</dd>
                </>
              )}
              
              {songData.attributes.genreNames && songData.attributes.genreNames.length > 0 && (
                <>
                  <dt className="text-sm font-medium text-muted-foreground">Genre</dt>
                  <dd className="text-sm">{songData.attributes.genreNames.join(', ')}</dd>
                </>
              )}
              
              {songData.attributes.releaseDate && (
                <>
                  <dt className="text-sm font-medium text-muted-foreground">Release Date</dt>
                  <dd className="text-sm">{new Date(songData.attributes.releaseDate).toLocaleDateString()}</dd>
                </>
              )}
              
              {songData.attributes.durationInMillis && (
                <>
                  <dt className="text-sm font-medium text-muted-foreground">Duration</dt>
                  <dd className="text-sm">{formatDuration(songData.attributes.durationInMillis)}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">No song information available</p>
        </div>
      )}
    </div>
  );
}
