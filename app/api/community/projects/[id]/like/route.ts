/**
 * Community Project Like API
 * POST /api/community/projects/[id]/like - Like a project
 * DELETE /api/community/projects/[id]/like - Unlike a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { getSupabaseUser } from '@/lib/supabase/auth';
import { isSupabaseConfigured } from '@/lib/supabase/client';

type RouteParams = Promise<{ id: string }>;

/**
 * POST /api/community/projects/[id]/like
 * Like a project
 */
export async function POST(
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

    // Check if project exists
    const { data: project } = await supabase
      .from('community_projects')
      .select('id, likes_count')
      .eq('id', id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Try to insert like
    const { error } = await supabase.from('project_likes').insert({
      profile_id: user.id,
      project_id: id
    });

    if (error) {
      // Already liked
      if (error.code === '23505') {
        // Check current like status
        const { data: like } = await supabase
          .from('project_likes')
          .select('*')
          .eq('profile_id', user.id)
          .eq('project_id', id)
          .single();

        return NextResponse.json({
          liked: true,
          likes_count: project.likes_count
        });
      }
      throw error;
    }

    // Increment likes count
    await supabase.rpc('increment_likes_count', { project_uuid: id }).then(({ error }) => { if (error) console.error(error); });

    return NextResponse.json({ liked: true, likes_count: project.likes_count + 1 });
  } catch (error) {
    console.error('Failed to like project:', error);
    return NextResponse.json(
      { error: 'Failed to like project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/community/projects/[id]/like
 * Unlike a project
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

    // Check if project exists
    const { data: project } = await supabase
      .from('community_projects')
      .select('id, likes_count')
      .eq('id', id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete like
    const { error } = await supabase
      .from('project_likes')
      .delete()
      .eq('profile_id', user.id)
      .eq('project_id', id);

    if (error) {
      console.error('Failed to unlike project:', error);
      return NextResponse.json(
        { error: 'Failed to unlike project' },
        { status: 500 }
      );
    }

    // Decrement likes count
    await supabase.rpc('decrement_likes_count', { project_uuid: id }).then(({ error }) => { if (error) console.error(error); });

    return NextResponse.json({ liked: false, likes_count: project.likes_count - 1 });
  } catch (error) {
    console.error('Failed to unlike project:', error);
    return NextResponse.json(
      { error: 'Failed to unlike project' },
      { status: 500 }
    );
  }
}
