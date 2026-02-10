/**
 * Community Project Download API
 * POST /api/community/projects/[id]/download - Download project (returns JSON for import)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { getSupabaseUser } from '@/lib/supabase/auth';
import { decompress } from '@/lib/compression';
import { isSupabaseConfigured } from '@/lib/supabase/client';

type RouteParams = Promise<{ id: string }>;

/**
 * POST /api/community/projects/[id]/download
 * Download a community project (returns JSON for import to IndexedDB)
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
    const supabase = getSupabaseServerClient();

    // Fetch project (must be public)
    const { data: project, error } = await supabase
      .from('community_projects')
      .select('files_jsonb, prompts_jsonb, title, description')
      .eq('id', id)
      .eq('visibility', 'public')
      .single();

    if (error || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Decompress files
    const files = project.files_jsonb.map((file: any) => ({
      path: file.path,
      content: decompress(file.content),
      language: file.language,
      size: file.size,
    }));

    // Track download
    const cookieStore = await cookies();
    const githubToken = cookieStore.get('github_token')?.value;
    let profileId = null;

    if (githubToken) {
      const user = await getSupabaseUser(githubToken);
      if (user) {
        profileId = user.id;
      }
    }

    // Record download (don't wait for it)
    supabase.from('project_downloads').insert({
      project_id: id,
      profile_id: profileId,
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null
    }).then(({ error }) => { if (error) console.error(error); });

    // Increment download count (don't wait for it)
    supabase.rpc('increment_project_download', { project_uuid: id }).then(({ error }) => { if (error) console.error(error); });

    // Return project data for import
    return NextResponse.json({
      title: project.title,
      description: project.description,
      files,
      prompts: project.prompts_jsonb || []
    });
  } catch (error) {
    console.error('Failed to download project:', error);
    return NextResponse.json(
      { error: 'Failed to download project' },
      { status: 500 }
    );
  }
}
