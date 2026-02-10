/**
 * Community Categories API
 * GET /api/community/categories - Get all active categories
 */

import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET() {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Community features are not configured' },
        { status: 503 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    return NextResponse.json({ categories: categories || [] });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
