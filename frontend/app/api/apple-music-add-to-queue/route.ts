import { NextRequest, NextResponse } from 'next/server';
import { toast } from '@/components/ui/use-toast';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { songIds, userToken } = body;
    
    if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json(
        { error: 'Song IDs are required' },
        { status: 400 }
      );
    }
    
    if (!userToken) {
      return NextResponse.json(
        { error: 'User token is required' },
        { status: 400 }
      );
    }
    
    // This is just a placeholder endpoint since we're using localStorage for the queue
    // In a real app, we might sync with a server-side queue
    return NextResponse.json({
      success: true,
      added: songIds.length,
      message: `${songIds.length} songs added to queue`
    });
  } catch (error) {
    console.error('Error in Add to Queue API route:', error);
    return NextResponse.json(
      { error: 'Failed to add songs to queue' },
      { status: 500 }
    );
  }
}
