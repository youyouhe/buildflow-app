import { Octokit } from "@octokit/rest";
import { createOctokit } from "./octokit";

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
}

export interface RepoFile {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
}

/**
 * Create a new GitHub repository
 */
export async function createRepository(
  token: string,
  options: CreateRepoOptions
) {
  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private ?? false,
      auto_init: options.autoInit ?? true,
      gitignore_template: options.gitignoreTemplate,
      license_template: options.licenseTemplate,
    });

    return data;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      if (error.status === 422) {
        throw new Error(`Repository '${options.name}' already exists`);
      }
    }
    throw new Error(`Failed to create repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * List repositories for the authenticated user
 */
export async function listRepositories(
  token: string,
  options?: {
    type?: "all" | "owner" | "public" | "private" | "member";
    sort?: "created" | "updated" | "pushed" | "full_name";
    direction?: "asc" | "desc";
    perPage?: number;
    page?: number;
  }
) {
  const octokit = createOctokit(token);

  const { data } = await octokit.repos.listForAuthenticatedUser({
    type: options?.type || "owner",
    sort: options?.sort || "updated",
    direction: options?.direction || "desc",
    per_page: options?.perPage || 30,
    page: options?.page || 1,
  });

  return data;
}

/**
 * Get a specific repository
 */
export async function getRepository(
  token: string,
  owner: string,
  repo: string
) {
  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.repos.get({ owner, repo });
    return data;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      throw new Error(`Repository '${owner}/${repo}' not found`);
    }
    throw error;
  }
}

/**
 * Delete a repository
 */
export async function deleteRepository(
  token: string,
  owner: string,
  repo: string
) {
  const octokit = createOctokit(token);

  try {
    await octokit.repos.delete({ owner, repo });
    return true;
  } catch (error) {
    throw new Error(`Failed to delete repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload a file to a repository
 */
export async function uploadFile(
  token: string,
  owner: string,
  repo: string,
  file: RepoFile,
  commitMessage?: string
) {
  const octokit = createOctokit(token);

  // Check if file exists
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: file.path,
    });
    if ('sha' in data) {
      sha = data.sha;
    }
  } catch {
    // File doesn't exist, that's fine
  }

  // Convert content to base64 if needed
  const content = file.encoding === "base64" 
    ? file.content 
    : Buffer.from(file.content, 'utf-8').toString('base64');

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: file.path,
    message: commitMessage || `Upload ${file.path}`,
    content,
    sha,
  });

  return data;
}

/**
 * Upload multiple files to a repository
 */
export async function uploadFiles(
  token: string,
  owner: string,
  repo: string,
  files: RepoFile[],
  commitMessage?: string
) {
  const results = [];
  
  for (const file of files) {
    const result = await uploadFile(
      token,
      owner,
      repo,
      file,
      commitMessage || `Upload ${files.length} files`
    );
    results.push(result);
  }

  return results;
}

/**
 * Get file contents from a repository
 */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string
) {
  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });

    if (!('content' in data)) {
      throw new Error(`Path '${path}' is not a file`);
    }

    // Decode base64 content
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      throw new Error(`File '${path}' not found`);
    }
    throw error;
  }
}

/**
 * Create or update a branch
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch?: string
) {
  const octokit = createOctokit(token);

  // Get the SHA of the source branch
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${fromBranch || 'main'}`,
  });

  // Create new branch
  const { data } = await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: refData.object.sha,
  });

  return data;
}

/**
 * List branches in a repository
 */
export async function listBranches(
  token: string,
  owner: string,
  repo: string
) {
  const octokit = createOctokit(token);

  const { data } = await octokit.repos.listBranches({ owner, repo });
  return data;
}

/**
 * Get repository topics (tags)
 */
export async function getTopics(
  token: string,
  owner: string,
  repo: string
) {
  const octokit = createOctokit(token);

  const { data } = await octokit.repos.getAllTopics({ owner, repo });
  return data.names;
}

/**
 * Set repository topics (tags)
 */
export async function setTopics(
  token: string,
  owner: string,
  repo: string,
  topics: string[]
) {
  const octokit = createOctokit(token);

  const { data } = await octokit.repos.replaceAllTopics({
    owner,
    repo,
    names: topics,
  });

  return data.names;
}
