import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRepository, deleteRepository, uploadFile } from "@/lib/github/repos";

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

/**
 * GET /api/github/repos/[owner]/[repo]
 * Get a specific repository
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
    const repository = await getRepository(token, owner, repo);

    return NextResponse.json(repository, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/github/repos/[owner]/[repo]
 * Delete a repository
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    await deleteRepository(token, owner, repo);

    return NextResponse.json(
      { message: "Repository deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/github/repos/[owner]/[repo]
 * Upload a file to the repository
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
    const { path, content, encoding, commitMessage } = body;

    if (!path || !content) {
      return NextResponse.json(
        { error: "path and content are required" },
        { status: 400 }
      );
    }

    const result = await uploadFile(
      token,
      owner,
      repo,
      { path, content, encoding },
      commitMessage
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
