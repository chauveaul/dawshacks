import { NextRequest, NextResponse } from 'next/server';
import { getUserMusicData } from '../../../lib/apple-music';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userToken } = body;
    
    if (!userToken) {
      return NextResponse.json(
        { error: 'User token is required' },
        { status: 400 }
      );
    }
    
    const musicData = await getUserMusicData(userToken);
    return NextResponse.json(musicData);
  } catch (error) {
    console.error('Error in Apple Music data API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Apple Music data' },
      { status: 500 }
    );
  }
}
