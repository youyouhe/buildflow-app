import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRepository, uploadFiles, getRepository } from "@/lib/github/repos";
import type { Page } from "@/types";

interface RouteParams {
  params: Promise<{
    namespace: string;
    repoId: string;
  }>;
}

/**
 * PUT /api/me/projects/[namespace]/[repoId]/update
 * Create or update a GitHub repository with AI-generated pages
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("github_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { namespace, repoId } = await params;
    const body = await request.json();
    const { pages, commitTitle, isNew, projectName } = body as {
      pages: Page[];
      commitTitle: string;
      isNew?: boolean;
      projectName?: string;
    };

    if (!pages || pages.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No pages provided" },
        { status: 400 }
      );
    }

    let owner = namespace;
    let repo = repoId;
    let repository;

    // If this is a new project, create the repository
    if (isNew || repoId === "new" || repoId === "unknown") {
      if (!projectName) {
        return NextResponse.json(
          { ok: false, error: "Project name is required for new projects" },
          { status: 400 }
        );
      }

      try {
        // Create the repository
        repository = await createRepository(token, {
          name: projectName,
          description: `AI-generated website: ${commitTitle}`,
          private: false,
          autoInit: true,
        });

        owner = repository.owner.login;
        repo = repository.name;
      } catch (error: any) {
        console.error("Failed to create repository:", error);
        return NextResponse.json(
          { ok: false, error: error.message || "Failed to create repository" },
          { status: 500 }
        );
      }
    } else {
      // Verify repository exists
      try {
        repository = await getRepository(token, owner, repo);
      } catch (error: any) {
        return NextResponse.json(
          { ok: false, error: `Repository not found: ${owner}/${repo}` },
          { status: 404 }
        );
      }
    }

    // Convert Pages to RepoFile format
    const files = pages.map((page) => ({
      path: page.path,
      content: page.html || page.content || "",
      encoding: "utf-8" as const,
    }));

    try {
      // Upload all files
      const results = await uploadFiles(
        token,
        owner,
        repo,
        files,
        commitTitle || "Update website"
      );

      // Get the latest commit info from the first result
      const latestCommit = results[0]?.commit;

      return NextResponse.json(
        {
          ok: true,
          repoId: `${owner}/${repo}`,
          commit: latestCommit
            ? {
                sha: latestCommit.sha,
                message: latestCommit.message,
                url: latestCommit.html_url,
              }
            : undefined,
          repository: {
            name: repository.name,
            fullName: repository.full_name,
            htmlUrl: repository.html_url,
            owner: repository.owner.login,
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("Failed to upload files:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to upload files" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Request error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
