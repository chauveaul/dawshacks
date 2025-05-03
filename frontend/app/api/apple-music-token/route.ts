import { NextRequest, NextResponse } from 'next/server';
import { generateDeveloperToken } from '../../../lib/apple-music';

export async function GET() {
  try {
    const token = await generateDeveloperToken();
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error in token API route:', error);
    return NextResponse.json(
      { error: 'Failed to generate Apple Music developer token' },
      { status: 500 }
    );
  }
}
