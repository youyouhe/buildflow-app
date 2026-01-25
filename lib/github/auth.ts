/**
 * GitHub Authentication utilities
 */

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  bio?: string;
}

/**
 * Initiate GitHub OAuth flow
 * Returns the OAuth URL - caller can either navigate to it or open in popup
 */
export function initiateGitHubLogin(): string {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    throw new Error('GitHub OAuth not configured');
  }
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'user repo', // user info + repo access
  });
  
  return `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Exchange authorization code for access token
 * This should be called from the OAuth callback page
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('/api/github/auth/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }
  
  const data = await response.json();
  return data.access_token;
}

/**
 * Get the current user's GitHub information
 */
export async function getGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GitHub Auth] Failed to fetch user:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 10) + '...',
    });
    throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Store GitHub token in secure cookie
 */
export function storeGitHubToken(token: string) {
  const isProduction = window.location.protocol === 'https:';
  const secureFlag = isProduction ? '; secure' : '';
  document.cookie = `github_token=${token}; path=/; samesite=lax${secureFlag}; max-age=${60 * 60 * 24 * 30}`; // 30 days
}

/**
 * Get GitHub token from cookie
 */
export function getGitHubToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'github_token') {
      return value;
    }
  }
  return null;
}

/**
 * Validate if a token is present and looks valid
 */
export function isValidToken(token: string | null | undefined): boolean {
  return !!(token && token.length > 10 && typeof token === 'string');
}

/**
 * Remove GitHub token (logout)
 */
export function removeGitHubToken() {
  document.cookie = 'github_token=; path=/; max-age=0';
}
