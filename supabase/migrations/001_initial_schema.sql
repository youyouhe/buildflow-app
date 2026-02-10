-- ============================================
-- BuildFlow Community Feature - Initial Schema
-- Uses separate 'community' schema to avoid conflicts
-- ============================================

-- Create community schema
CREATE SCHEMA IF NOT EXISTS community;

-- Grant usage on schema to authenticated users and public
GRANT USAGE ON SCHEMA community TO authenticated;
GRANT USAGE ON SCHEMA community TO anon;
GRANT USAGE ON SCHEMA community TO postgres;

-- ============================================
-- Profiles Table
-- Syncs with GitHub users
-- ============================================
CREATE TABLE community.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id INTEGER UNIQUE NOT NULL,
  github_login VARCHAR(255) NOT NULL,
  github_name VARCHAR(255),
  github_email VARCHAR(255),
  github_avatar_url TEXT,
  github_bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_community_profiles_github_id ON community.profiles(github_id);
CREATE INDEX idx_community_profiles_github_login ON community.profiles(github_login);

-- ============================================
-- Categories Table
-- Project categories for organization
-- ============================================
CREATE TABLE community.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  color VARCHAR(20),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_community_categories_slug ON community.categories(slug);
CREATE INDEX idx_community_categories_active ON community.categories(is_active);

-- ============================================
-- Community Projects Table
-- Stores shared projects with metadata
-- ============================================
CREATE TABLE community.community_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES community.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES community.categories(id) ON DELETE SET NULL,

  -- Project metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail TEXT,

  -- Project data (compressed using LZ-String)
  files_jsonb JSONB NOT NULL,
  prompts_jsonb JSONB,

  -- Integration data (optional)
  github_repo JSONB,
  vercel_deployment JSONB,

  -- Access control
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private')),

  -- Engagement metrics
  views_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  forks_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,

  -- Metadata
  file_count INTEGER DEFAULT 0,
  total_size INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED
);

CREATE INDEX idx_community_projects_profile_id ON community.community_projects(profile_id);
CREATE INDEX idx_community_projects_category_id ON community.community_projects(category_id);
CREATE INDEX idx_community_projects_visibility ON community.community_projects(visibility);
CREATE INDEX idx_community_projects_created_at ON community.community_projects(created_at DESC);
CREATE INDEX idx_community_projects_views_count ON community.community_projects(views_count DESC);
CREATE INDEX idx_community_projects_downloads_count ON community.community_projects(downloads_count DESC);
CREATE INDEX idx_community_projects_search_vector ON community.community_projects USING GIN(search_vector);

-- ============================================
-- Project Likes Table
-- Tracks user likes on community projects
-- ============================================
CREATE TABLE community.project_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES community.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES community.community_projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, project_id)
);

CREATE INDEX idx_community_project_likes_profile_id ON community.project_likes(profile_id);
CREATE INDEX idx_community_project_likes_project_id ON community.project_likes(project_id);

-- ============================================
-- Project Downloads Table
-- Tracks project downloads for analytics
-- ============================================
CREATE TABLE community.project_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES community.community_projects(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES community.profiles(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_community_project_downloads_project_id ON community.project_downloads(project_id);
CREATE INDEX idx_community_project_downloads_created_at ON community.project_downloads(created_at DESC);

-- ============================================
-- Enable Row Level Security
-- ============================================
ALTER TABLE community.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.community_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.project_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community.project_downloads ENABLE ROW LEVEL SECURITY;

-- Grant select permissions to anon and authenticated
GRANT SELECT ON community.profiles TO anon;
GRANT SELECT ON community.profiles TO authenticated;
GRANT SELECT ON community.categories TO anon;
GRANT SELECT ON community.categories TO authenticated;
GRANT SELECT ON community.community_projects TO anon;
GRANT SELECT ON community.community_projects TO authenticated;
GRANT SELECT ON community.project_likes TO anon;
GRANT SELECT ON community.project_likes TO authenticated;
GRANT SELECT, INSERT ON community.project_downloads TO anon;
GRANT SELECT, INSERT ON community.project_downloads TO authenticated;
