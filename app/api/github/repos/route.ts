import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listRepositories, createRepository } from "@/lib/github/repos";

/**
 * GET /api/github/repos
 * List repositories for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("github_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "all" | "owner" | "public" | "private" | "member" | null;
    const sort = searchParams.get("sort") as "created" | "updated" | "pushed" | "full_name" | null;
    const direction = searchParams.get("direction") as "asc" | "desc" | null;
    const page = searchParams.get("page");
    const perPage = searchParams.get("per_page");

    const repos = await listRepositories(token, {
      type: type || "owner",
      sort: sort || "updated",
      direction: direction || "desc",
      page: page ? parseInt(page) : 1,
      perPage: perPage ? parseInt(perPage) : 30,
    });

    return NextResponse.json(repos, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/github/repos
 * Create a new repository
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("github_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, private: isPrivate, autoInit, gitignoreTemplate, licenseTemplate } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 }
      );
    }

    const repo = await createRepository(token, {
      name,
      description,
      private: isPrivate,
      autoInit,
      gitignoreTemplate,
      licenseTemplate,
    });

    return NextResponse.json(repo, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
