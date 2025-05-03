import { NextResponse } from 'next/server';

// API route to send song metadata to the Go backend
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.artist || !data.songId || !data.duration) {
      return NextResponse.json(
        { error: 'Missing required song metadata' },
        { status: 400 }
      );
    }

    // Send data to the Go backend
    const backendResponse = await fetch('http://localhost:8080/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: data.songId,
        title: data.title,
        artist: data.artist,
        album_picture: data.albumPicture || [], // Use empty array if no image data
        duration: data.duration,
      }),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend returned ${backendResponse.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error queueing song:', error);
    return NextResponse.json(
      { error: 'Failed to queue song' },
      { status: 500 }
    );
  }
}
