import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Types for Apple Music API responses
export interface AppleMusicUserData {
  recentlyPlayed: any[];
  playlists: any[];
  userProfile?: {
    name?: string;
    profilePicture?: string;
  };
}

export interface SearchResult {
  id: string;
  type: 'songs' | 'albums' | 'artists' | 'playlists';
  attributes: {
    name: string;
    artistName?: string;
    artworkUrl?: string;
    artwork?: {
      url?: string;
    };
  };
}

export const generateDeveloperToken = async (): Promise<string> => {
  try {
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKeyPath = process.env.APPLE_PRIVATE_KEY_PATH;

    // If we already have a token, return that instead of generating a new one
    const existingToken = process.env.APPLE_MUSIC_DEV_TOKEN;
    if (existingToken && existingToken !== '') {
      return existingToken;
    }

    if (!teamId || !keyId || !privateKeyPath) {
      throw new Error('Missing required Apple Music credentials');
    }

    // Read the private key from file
    const privateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');

    // Create a JWT token
    const token = jwt.sign({}, privateKey, {
      algorithm: 'ES256',
      expiresIn: '180d', // 180 days expiration
      keyid: keyId,
      issuer: teamId,
    });

    return token;
  } catch (error) {
    console.error('Error generating Apple Music developer token:', error);
    throw error;
  }
};

// This function will be used on the client-side to initialize MusicKit
export const initializeMusicKit = async () => {
  try {
    const token = await generateDeveloperToken();
    return token;
  } catch (error) {
    console.error('Error initializing MusicKit:', error);
    throw error;
  }
};

// Helper function to fetch data from Apple Music API (used server-side)
export const fetchFromAppleMusicApi = async (
  endpoint: string, 
  userToken: string,
  options: { method?: string; body?: any } = {}
) => {
  const developerToken = await generateDeveloperToken();
  
  const response = await fetch(`https://api.music.apple.com/v1/${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${developerToken}`,
      'Music-User-Token': userToken,
      'Content-Type': 'application/json',
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    throw new Error(`Apple Music API error: ${response.status}`);
  }

  return response.json();
};

// Function to get the user's profile information
export const getUserProfile = async (userToken: string) => {
  try {
    // Default profile picture if none is available
    const defaultProfile = {
      name: 'Music Lover',
      profilePicture: ''
    };

    try {
      // Fetch user's profile from Apple Music API
      // Note: Some Apple Music accounts may not have profile info accessible via API
      const response = await fetchFromAppleMusicApi('me', userToken)
        .catch(error => {
          console.log('User profile fetch failed, using default profile:', error.message);
          return null;
        });
      
      if (response && response.data && response.data.length > 0) {
        const user = response.data[0];
        return {
          name: user.attributes?.name || defaultProfile.name,
          profilePicture: user.attributes?.artwork?.url || defaultProfile.profilePicture
        };
      }
    } catch (error) {
      // Just log the error but continue with default profile
      console.log('Error in getUserProfile inner try/catch:', error);
    }
    
    return defaultProfile;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return {
      name: 'Music Lover',
      profilePicture: ''
    };
  }
};

// Function to search for music content
export const searchAppleMusic = async (
  query: string,
  userToken: string,
  types: Array<'songs' | 'albums' | 'artists' | 'playlists'> = ['songs'],
  limit: number = 5
): Promise<{[key: string]: SearchResult[]}> => {
  if (!query || query.trim().length === 0) {
    return { songs: [], albums: [], artists: [], playlists: [] };
  }
  
  try {
    const typesParam = types.join(',');
    const encodedQuery = encodeURIComponent(query.trim());
    
    const searchEndpoint = `catalog/us/search?term=${encodedQuery}&types=${typesParam}&limit=${limit}`;
    const response = await fetchFromAppleMusicApi(searchEndpoint, userToken);
    
    const results: {[key: string]: SearchResult[]} = {};
    
    // Process each result type (songs, albums, etc.)
    types.forEach(type => {
      const typeResults = response.results?.[type]?.data || [];
      results[type] = typeResults;
    });
    
    return results;
  } catch (error) {
    console.error('Error searching Apple Music:', error);
    return { songs: [], albums: [], artists: [], playlists: [] };
  }
};

// Function to get a playlist's details including its tracks
export const getPlaylistDetails = async (playlistId: string, userToken: string) => {
  try {
    // Get playlist details
    const response = await fetchFromAppleMusicApi(`me/library/playlists/${playlistId}`, userToken);
    
    if (!response.data || response.data.length === 0) {
      throw new Error('Playlist not found');
    }
    
    const playlist = response.data[0];
    
    // Get playlist tracks
    const tracksResponse = await fetchFromAppleMusicApi(`me/library/playlists/${playlistId}/tracks`, userToken);
    
    return {
      ...playlist,
      tracks: tracksResponse.data || []
    };
  } catch (error) {
    console.error('Error fetching playlist details:', error);
    throw error;
  }
};

// Function to get a user's recently played music and playlists
export const getUserMusicData = async (userToken: string): Promise<AppleMusicUserData> => {
  try {
    // Create a default response structure
    const result: AppleMusicUserData = {
      recentlyPlayed: [],
      playlists: [],
      userProfile: {
        name: 'Music Lover',
        profilePicture: ''
      }
    };
    
    try {
      // Get recently played tracks using the correct endpoint
      const recentlyPlayed = await fetchFromAppleMusicApi('me/recent/played/tracks', userToken)
        .catch(error => {
          console.log('Error fetching recently played tracks:', error.message);
          return { data: [] };
        });
      
      result.recentlyPlayed = recentlyPlayed.data || [];
    } catch (error) {
      console.error('Failed to fetch recently played tracks:', error);
      // Continue with empty recently played tracks
    }
    
    try {
      // Get user's playlists
      const playlists = await fetchFromAppleMusicApi('me/library/playlists', userToken)
        .catch(error => {
          console.log('Error fetching playlists:', error.message);
          return { data: [] };
        });
      
      result.playlists = playlists.data || [];
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
      // Continue with empty playlists
    }
    
    // Get user profile information
    try {
      const userProfile = await getUserProfile(userToken);
      result.userProfile = userProfile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      // User profile already has default values
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching user music data:', error);
    // Return a default structure even if everything fails
    return {
      recentlyPlayed: [],
      playlists: [],
      userProfile: {
        name: 'Music Lover',
        profilePicture: ''
      }
    };
  }
};

/**
 * Get details for a specific song by ID
 */
export async function getSongDetails(songId: string, userToken: string): Promise<any> {
  // Try to get the song from catalog first
  try {
    const catalogUrl = `catalog/us/songs/${songId}`;
    const catalogResponse = await fetch(`https://api.music.apple.com/v1/${catalogUrl}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await generateDeveloperToken()}`,
        'Music-User-Token': userToken,
        'Content-Type': 'application/json'
      },
    });
    
    if (catalogResponse.ok) {
      const catalogData = await catalogResponse.json();
      if (catalogData.data && catalogData.data.length > 0) {
        return catalogData.data[0];
      }
    }
    // If catalog didn't work, we'll try library next - don't throw here
    console.log(`Catalog lookup failed with status ${catalogResponse.status}, trying library...`);
  } catch (error) {
    console.log("Error in catalog lookup, trying library...", error);
    // Don't rethrow, continue to library lookup
  }
  
  // If catalog failed or returned no results, try the library
  try {
    const libraryUrl = `me/library/songs/${songId}`;
    const libraryResponse = await fetch(`https://api.music.apple.com/v1/${libraryUrl}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await generateDeveloperToken()}`,
        'Music-User-Token': userToken,
        'Content-Type': 'application/json'
      },
    });
    
    if (libraryResponse.ok) {
      const libraryData = await libraryResponse.json();
      if (libraryData.data && libraryData.data.length > 0) {
        return libraryData.data[0];
      }
    }
    console.log(`Library lookup failed with status ${libraryResponse.status}`);
  } catch (error) {
    console.log("Error in library lookup", error);
  }
  
  // If we got here, both catalog and library failed - try one more fallback
  // Some songs have IDs that start with 'i.' but need to be queried without it
  if (songId.startsWith('i.')) {
    try {
      const altSongId = songId.substring(2); // Remove 'i.' prefix
      const altUrl = `catalog/us/songs/${altSongId}`;
      const altResponse = await fetch(`https://api.music.apple.com/v1/${altUrl}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await generateDeveloperToken()}`,
          'Music-User-Token': userToken,
          'Content-Type': 'application/json'
        },
      });
      
      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (altData.data && altData.data.length > 0) {
          return altData.data[0];
        }
      }
      console.log(`Alternative ID lookup failed with status ${altResponse.status}`);
    } catch (error) {
      console.log("Error in alternative ID lookup", error);
    }
  }
  
  // If all lookups failed, create a placeholder song object with what we know
  return {
    id: songId,
    type: "songs",
    attributes: {
      name: "Unknown Song",
      artistName: "Unknown Artist",
      albumName: "Unknown Album"
    }
  };
}
