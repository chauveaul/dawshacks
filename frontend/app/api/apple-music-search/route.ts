import { NextRequest, NextResponse } from 'next/server';
import { searchAppleMusic } from '../../../lib/apple-music';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userToken, types = ['songs'], limit = 5 } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    if (!userToken) {
      return NextResponse.json(
        { error: 'User token is required' },
        { status: 400 }
      );
    }
    
    const results = await searchAppleMusic(query, userToken, types, limit);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in Apple Music search API route:', error);
    return NextResponse.json(
      { error: 'Failed to search Apple Music' },
      { status: 500 }
    );
  }
}
