/**
 * Community Projects API
 * GET /api/community/projects - List public projects with filters
 * POST /api/community/projects - Create new community project
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { getSupabaseUser } from '@/lib/supabase/auth';
import { compress } from '@/lib/compression';
import { isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * GET /api/community/projects
 * Query params:
 * - category: category slug (optional)
 * - sort: 'recent' | 'popular' | 'trending' | 'downloads' (default: 'recent')
 * - search: search query (optional)
 * - page: page number (default: 1)
 * - limit: items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Community features are not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const sort = searchParams.get('sort') || 'recent';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const supabase = getSupabaseServerClient();

    let query = supabase
      .from('community_projects')
      .select(`
        id,
        title,
        description,
        thumbnail,
        visibility,
        views_count,
        downloads_count,
        likes_count,
        file_count,
        total_size,
        created_at,
        updated_at,
        category:categories(id, slug, name, icon, color),
        profile:profiles(id, github_login, github_name, github_avatar_url)
      `, { count: 'exact' })
      .eq('visibility', 'public');

    // Filter by category
    if (category) {
      query = query.eq('category.slug', category);
    }

    // Full-text search
    if (search) {
      query = query.textSearch('search_vector', search);
    }

    // Sorting
    switch (sort) {
      case 'popular':
        query = query.order('views_count', { ascending: false });
        break;
      case 'trending':
        query = query.order('likes_count', { ascending: false });
        break;
      case 'downloads':
        query = query.order('downloads_count', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      console.error('Failed to fetch community projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      projects: projects || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch community projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/community/projects
 * Create a new community project
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Community features are not configured' },
        { status: 503 }
      );
    }

    // Get GitHub token from cookie
    const cookieStore = await cookies();
    const githubToken = cookieStore.get('github_token')?.value;

    if (!githubToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get Supabase user
    const user = await getSupabaseUser(githubToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      categoryId,
      thumbnail,
      files,
      prompts,
      githubRepo,
      vercelDeployment,
      visibility = 'public'
    } = body;

    // Validate required fields
    if (!title || !files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, files' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Calculate file count and total size
    const fileCount = files.length;
    const totalSize = files.reduce((sum: number, file: any) => sum + (file.size || 0), 0);

    // Compress files using LZ-String
    const compressedFiles = files.map((file: any) => ({
      path: file.path,
      content: compress(file.content),
      language: file.language,
      size: file.size,
      compressed: true
    }));

    const { data: project, error } = await supabase
      .from('community_projects')
      .insert({
        profile_id: user.id,
        category_id: categoryId || null,
        title,
        description: description || null,
        thumbnail: thumbnail || null,
        files_jsonb: compressedFiles,
        prompts_jsonb: prompts || null,
        github_repo: githubRepo || null,
        vercel_deployment: vercelDeployment || null,
        visibility,
        file_count: fileCount,
        total_size: totalSize
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create community project:', error);
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create community project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
