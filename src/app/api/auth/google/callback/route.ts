import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client } from '@/lib/google-drive-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json({ 
        error: 'Authorization code tidak ditemukan' 
      }, { status: 400 });
    }

    const oauth2Client = createOAuth2Client();
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens (in production, store in database/session)
    // For now, we'll return them to be stored in frontend
    return NextResponse.json({
      success: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });

  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return NextResponse.json({ 
      error: 'Gagal exchange authorization code' 
    }, { status: 500 });
  }
}
