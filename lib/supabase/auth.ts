/**
 * Supabase Authentication Utilities
 * Integrates GitHub OAuth user with Supabase profiles
 */

import { getGitHubUser, GitHubUser } from '@/lib/github/auth';
import { getSupabaseServerClient } from './client';

export interface SupabaseUser {
  id: string;
  githubId: number;
  githubLogin: string;
  githubName: string | null;
  githubEmail: string | null;
  githubAvatarUrl: string;
  githubBio: string | null;
}

/**
 * Sync GitHub user with Supabase profile
 * Creates a new profile if it doesn't exist, or updates existing one
 */
export async function getSupabaseUser(githubToken: string): Promise<SupabaseUser | null> {
  try {
    // Get GitHub user data
    const githubUser = await getGitHubUser(githubToken);

    // Get Supabase server client
    const supabase = getSupabaseServerClient();

    // Call the get_or_create_profile function
    const { data: profileId, error: rpcError } = await supabase.rpc('get_or_create_profile', {
      p_github_id: githubUser.id,
      p_github_login: githubUser.login,
      p_github_name: githubUser.name || null,
      p_github_email: githubUser.email || null,
      p_github_avatar_url: githubUser.avatar_url,
      p_github_bio: githubUser.bio || null,
    });

    if (rpcError) {
      console.error('Failed to get or create profile:', rpcError);
      throw rpcError;
    }

    // Fetch complete profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError) {
      console.error('Failed to fetch profile:', profileError);
      throw profileError;
    }

    return {
      id: profile.id,
      githubId: profile.github_id,
      githubLogin: profile.github_login,
      githubName: profile.github_name,
      githubEmail: profile.github_email,
      githubAvatarUrl: profile.github_avatar_url,
      githubBio: profile.github_bio,
    };
  } catch (error) {
    console.error('Failed to get Supabase user:', error);
    return null;
  }
}

/**
 * Create a Supabase auth token for a GitHub user
 * This allows using Supabase RLS with GitHub authentication
 */
export async function createSupabaseSession(githubToken: string): Promise<string | null> {
  try {
    const user = await getSupabaseUser(githubToken);
    if (!user) {
      return null;
    }

    // Create a Supabase session using admin API
    const supabase = getSupabaseServerClient();

    // Generate a JWT token for the user
    // Note: This requires the user to exist in Supabase Auth
    // For now, we'll rely on the GitHub user ID in RLS policies
    // In the future, we might want to create actual Supabase Auth users

    return null; // Placeholder for future implementation
  } catch (error) {
    console.error('Failed to create Supabase session:', error);
    return null;
  }
}

/**
 * Get the current user's profile from Supabase
 * This is a helper for API routes
 */
export async function getCurrentProfile(githubToken: string) {
  const user = await getSupabaseUser(githubToken);
  if (!user) {
    return null;
  }

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Failed to fetch profile:', error);
    return null;
  }

  return data;
}
