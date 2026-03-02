import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, googleSheetsConfig } from '@/lib/google-drive-config';

export async function GET(_request: NextRequest) {
  try {
    const oauth2Client = createOAuth2Client();
    
    // Generate OAuth2 URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: googleSheetsConfig.scopes,
      prompt: 'consent'
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({ 
      error: 'Gagal generate auth URL' 
    }, { status: 500 });
  }
}
