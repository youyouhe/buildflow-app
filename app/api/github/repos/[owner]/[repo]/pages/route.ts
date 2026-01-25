import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deployToGitHubPages, getGitHubPagesInfo, enableGitHubPages } from "@/lib/github/pages";

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

/**
 * GET /api/github/repos/[owner]/[repo]/pages
 * Get GitHub Pages information
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("github_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { owner, repo } = await params;
    const pagesInfo = await getGitHubPagesInfo(token, owner, repo);

    if (!pagesInfo) {
      return NextResponse.json(
        { error: "GitHub Pages not enabled for this repository" },
        { status: 404 }
      );
    }

    return NextResponse.json(pagesInfo, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/github/repos/[owner]/[repo]/pages
 * Deploy to GitHub Pages or enable GitHub Pages
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("github_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { owner, repo } = await params;
    const body = await request.json();

    // If files are provided, deploy them
    if (body.files && Array.isArray(body.files)) {
      const { files, commitMessage } = body;

      const result = await deployToGitHubPages(
        token,
        owner,
        repo,
        files,
        commitMessage
      );

      return NextResponse.json(result, { status: 200 });
    } else {
      // Otherwise, just enable GitHub Pages
      const { branch, path } = body;

      const result = await enableGitHubPages(
        token,
        owner,
        repo,
        branch || "gh-pages",
        path || "/"
      );

      return NextResponse.json(result, { status: 200 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
