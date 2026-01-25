import { Octokit } from "@octokit/rest";

/**
 * Create an authenticated Octokit client
 */
export function createOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: "BuildFlow v1.0.0",
  });
}

/**
 * Get the authenticated user's information
 */
export async function getAuthenticatedUser(octokit: Octokit) {
  try {
    const { data } = await octokit.users.getAuthenticated();
    return data;
  } catch (error) {
    throw new Error(`Failed to get authenticated user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a repository exists
 */
export async function checkRepoExists(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    await octokit.repos.get({ owner, repo });
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get rate limit information
 */
export async function getRateLimit(octokit: Octokit) {
  const { data } = await octokit.rateLimit.get();
  return data.rate;
}
