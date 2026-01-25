import { createOctokit } from "./octokit";
import { RepoFile, uploadFiles, createBranch, listBranches } from "./repos";

/**
 * Enable GitHub Pages for a repository
 */
export async function enableGitHubPages(
  token: string,
  owner: string,
  repo: string,
  branch: string = "gh-pages",
  path: "/" | "/docs" = "/"
) {
  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.repos.createPagesSite({
      owner,
      repo,
      source: {
        branch,
        path,
      },
    });

    return data;
  } catch (error) {
    // Pages might already be enabled
    if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
      // Update existing Pages configuration
      const { data } = await octokit.repos.updateInformationAboutPagesSite({
        owner,
        repo,
        source: {
          branch,
          path,
        },
      });
      return data;
    }
    throw new Error(`Failed to enable GitHub Pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get GitHub Pages information
 */
export async function getGitHubPagesInfo(
  token: string,
  owner: string,
  repo: string
) {
  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.repos.getPages({ owner, repo });
    return data;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return null; // Pages not enabled
    }
    throw error;
  }
}

/**
 * Deploy to GitHub Pages
 * This creates/updates the gh-pages branch with the provided files
 */
export async function deployToGitHubPages(
  token: string,
  owner: string,
  repo: string,
  files: RepoFile[],
  commitMessage?: string
) {
  const octokit = createOctokit(token);

  // Check if gh-pages branch exists
  const branches = await listBranches(token, owner, repo);
  const ghPagesBranch = branches.find(b => b.name === "gh-pages");

  if (!ghPagesBranch) {
    // Create gh-pages branch
    try {
      await createBranch(token, owner, repo, "gh-pages", "main");
    } catch (error) {
      // Try with 'master' as fallback
      try {
        await createBranch(token, owner, repo, "gh-pages", "master");
      } catch {
        throw new Error("Failed to create gh-pages branch. Could not find main or master branch.");
      }
    }
  }

  // Upload files to gh-pages branch
  const results = [];
  for (const file of files) {
    try {
      // Get current file SHA if it exists
      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: "gh-pages",
        });
        if ('sha' in data) {
          sha = data.sha;
        }
      } catch {
        // File doesn't exist
      }

      // Convert content to base64
      const content = file.encoding === "base64" 
        ? file.content 
        : Buffer.from(file.content, 'utf-8').toString('base64');

      const result = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message: commitMessage || `Deploy to GitHub Pages`,
        content,
        branch: "gh-pages",
        sha,
      });

      results.push(result.data);
    } catch (error) {
      throw new Error(`Failed to upload ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enable GitHub Pages if not already enabled
  try {
    await enableGitHubPages(token, owner, repo, "gh-pages", "/");
  } catch (error) {
    console.error("Failed to enable GitHub Pages:", error);
    // Continue anyway - Pages might already be enabled
  }

  // Get Pages info to return the URL
  const pagesInfo = await getGitHubPagesInfo(token, owner, repo);

  return {
    results,
    pagesUrl: pagesInfo?.html_url || `https://${owner}.github.io/${repo}/`,
  };
}

/**
 * Disable GitHub Pages for a repository
 */
export async function disableGitHubPages(
  token: string,
  owner: string,
  repo: string
) {
  const octokit = createOctokit(token);

  try {
    await octokit.repos.deletePagesSite({ owner, repo });
    return true;
  } catch (error) {
    throw new Error(`Failed to disable GitHub Pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get GitHub Pages build status
 */
export async function getPagesBuildStatus(
  token: string,
  owner: string,
  repo: string
) {
  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.repos.getLatestPagesBuild({ owner, repo });
    return data;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return null;
    }
    throw error;
  }
}
