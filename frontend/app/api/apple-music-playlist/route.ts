import { NextRequest, NextResponse } from 'next/server';
import { getPlaylistDetails } from '../../../lib/apple-music';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userToken } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Playlist ID is required' },
        { status: 400 }
      );
    }
    
    if (!userToken) {
      return NextResponse.json(
        { error: 'User token is required' },
        { status: 400 }
      );
    }
    
    // Fetch playlist details from Apple Music API
    const playlistDetails = await getPlaylistDetails(id, userToken);
    
    return NextResponse.json(playlistDetails);
  } catch (error) {
    console.error('Error in Apple Music playlist API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playlist details' },
      { status: 500 }
    );
  }
}
