'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Clock, 
  Loader2, 
  Music, 
  Search 
} from 'lucide-react';

interface QueueItem {
  id: string;
  name: string;
  artist: string;
  artwork: string;
  addedAt: string;
}

export default function DownloadQueue() {
  const router = useRouter();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Load queue items from localStorage on component mount
  useEffect(() => {
    const loadQueue = () => {
      const queueString = localStorage.getItem('songQueue') || '[]';
      try {
        const queue = JSON.parse(queueString);
        setQueueItems(queue);
      } catch (error) {
        console.error('Error parsing queue:', error);
        setQueueItems([]);
      }
      setIsLoaded(true);
    };
    
    loadQueue();
  }, []);
  
  // Format the artwork URL
  const formatArtworkUrl = (url: string): string => {
    if (!url) return '';
    
    try {
      // Handle URLs with placeholders
      if (url.includes('{w}') && url.includes('{h}')) {
        return url.replace('{w}', '300').replace('{h}', '300');
      }
      
      return url;
    } catch (error) {
      console.error('Error formatting artwork URL:', error);
      return '';
    }
  };
  
  // Handle removing an item from the queue
  const removeFromQueue = (id: string) => {
    const updatedQueue = queueItems.filter(item => item.id !== id);
    setQueueItems(updatedQueue);
    localStorage.setItem('songQueue', JSON.stringify(updatedQueue));
  };
  
  // Simulate downloading a song
  const downloadSong = async (id: string) => {
    setProcessing(id);
    
    // Simulate a download process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Remove the song from the queue after "downloading"
    removeFromQueue(id);
    setProcessing(null);
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  // Navigate to song details
  const goToSongDetails = (id: string) => {
    router.push(`/songs/${id}`);
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 bg-background">
      {/* Top bar with back button */}
      <div className="flex items-center gap-3 mb-8">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        
        <h1 className="text-2xl font-bold">Download Queue</h1>
      </div>
      
      {/* Queue content */}
      <div className="mt-6">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : queueItems.length === 0 ? (
          <div className="p-4">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-4 mb-4">
                <Loader2 className="w-6 h-6 text-zinc-500" />
              </div>
              <h3 className="text-lg font-medium mb-1">Your queue is empty</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Add songs to your download queue from song details pages.
              </p>
              <Button 
                onClick={() => router.push('/')}
                variant="outline"
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Browse Music
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{queueItems.length} song{queueItems.length !== 1 ? 's' : ''} in queue</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {queueItems.map((item, index) => (
                <div 
                  key={item.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <div 
                    className="w-12 h-12 relative flex-shrink-0 bg-zinc-200 dark:bg-zinc-700 rounded overflow-hidden cursor-pointer"
                    onClick={() => goToSongDetails(item.id)}
                  >
                    {item.artwork ? (
                      <Image
                        src={formatArtworkUrl(item.artwork)}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Music className="w-6 h-6 text-zinc-400" />
                      </div>
                    )}
                  </div>
                  
                  <div 
                    className="flex-1 cursor-pointer" 
                    onClick={() => goToSongDetails(item.id)}
                  >
                    <h3 className="font-medium text-sm line-clamp-1">{item.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.artist}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Added {formatDate(item.addedAt)}
                    </p>
                  </div>
                  
                  <div>
                    <Button
                      size="sm"
                      className={`rounded-full flex gap-1 items-center ${index === 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-300'}`}
                      disabled
                    >
                      {index === 0 ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">Downloading</span>
                        </>
                      ) : (
                        <span className="text-xs">Waiting...</span>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
