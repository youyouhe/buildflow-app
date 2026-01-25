import { NextResponse } from 'next/server';

/**
 * GitHub OAuth callback handler
 * Exchanges authorization code for access token
 */
export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      console.error('[GitHub OAuth] No code provided in request');
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Log env vars status (without exposing secrets)
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    console.error('[GitHub OAuth] Client ID configured:', !!clientId);
    console.error('[GitHub OAuth] Client Secret configured:', !!clientSecret);

    if (!clientId || !clientSecret) {
      console.error('[GitHub OAuth] Missing environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: GitHub OAuth not properly configured' },
        { status: 500 }
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[GitHub OAuth] Token exchange failed:', tokenResponse.status, errorText);
      throw new Error('Failed to exchange code for token');
    }

    const data = await tokenResponse.json();

    if (data.error) {
      console.error('[GitHub OAuth] OAuth error:', data.error, data.error_description);
      return NextResponse.json(
        { error: data.error_description || 'OAuth error' },
        { status: 400 }
      );
    }
    
    // Return the access token to the client
    // The client will store it in a cookie
    return NextResponse.json({
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope,
    });
    
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
