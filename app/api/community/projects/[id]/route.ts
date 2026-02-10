/**
 * Community Project Detail API
 * GET /api/community/projects/[id] - Get single project
 * PATCH /api/community/projects/[id] - Update project (owner only)
 * DELETE /api/community/projects/[id] - Delete project (owner only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { getSupabaseUser } from '@/lib/supabase/auth';
import { isSupabaseConfigured } from '@/lib/supabase/client';

type RouteParams = Promise<{ id: string }>;

/**
 * GET /api/community/projects/[id]
 * Get a single community project by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Community features are not configured' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const supabase = getSupabaseServerClient();

    // Increment view count (don't wait for it)
    supabase.rpc('increment_project_view', { project_uuid: id }).then(({ error }) => { if (error) console.error(error); });

    const { data: project, error } = await supabase
      .from('community_projects')
      .select(`
        *,
        category:categories(id, slug, name, icon, color),
        profile:profiles(id, github_login, github_name, github_avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check visibility for private projects
    if (project.visibility === 'private') {
      const cookieStore = await cookies();
      const githubToken = cookieStore.get('github_token')?.value;

      if (!githubToken) {
        return NextResponse.json(
          { error: 'Private project' },
          { status: 403 }
        );
      }

      const user = await getSupabaseUser(githubToken);
      if (!user || user.id !== project.profile_id) {
        return NextResponse.json(
          { error: 'Private project' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Failed to fetch project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/community/projects/[id]
 * Update a community project (owner only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Community features are not configured' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const cookieStore = await cookies();
    const githubToken = cookieStore.get('github_token')?.value;

    if (!githubToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await getSupabaseUser(githubToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const supabase = getSupabaseServerClient();

    // Check ownership
    const { data: existing } = await supabase
      .from('community_projects')
      .select('profile_id')
      .eq('id', id)
      .single();

    if (!existing || existing.profile_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this project' },
        { status: 403 }
      );
    }

    // Only allow updating certain fields
    const allowedUpdates: Record<string, any> = {};
    const allowedFields = ['title', 'description', 'category_id', 'thumbnail', 'visibility'];
    for (const field of allowedFields) {
      if (field in body) {
        allowedUpdates[field] = body[field];
      }
    }

    const { data: project, error } = await supabase
      .from('community_projects')
      .update(allowedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update project:', error);
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/community/projects/[id]
 * Delete a community project (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Community features are not configured' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const cookieStore = await cookies();
    const githubToken = cookieStore.get('github_token')?.value;

    if (!githubToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await getSupabaseUser(githubToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Check ownership
    const { data: existing } = await supabase
      .from('community_projects')
      .select('profile_id')
      .eq('id', id)
      .single();

    if (!existing || existing.profile_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this project' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('community_projects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete project:', error);
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
