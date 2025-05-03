import { NextRequest, NextResponse } from 'next/server';
import { getSongDetails } from '../../../lib/apple-music';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userToken } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Song ID is required' },
        { status: 400 }
      );
    }
    
    if (!userToken) {
      return NextResponse.json(
        { error: 'User token is required' },
        { status: 400 }
      );
    }
    
    try {
      // Fetch song details using our new function
      const songData = await getSongDetails(id, userToken);
      
      // Return the song data
      return NextResponse.json(songData);
    } catch (songError) {
      console.error('Error fetching song details:', songError);
      
      // Return a placeholder song instead of an error
      const placeholderSong = {
        id: id,
        type: "songs",
        attributes: {
          name: "Unknown Song",
          artistName: "Unknown Artist",
          albumName: "Unknown Album"
        }
      };
      
      return NextResponse.json(placeholderSong);
    }
  } catch (error) {
    console.error('Error in Apple Music song API route:', error);
    
    // Return a generic error response
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
