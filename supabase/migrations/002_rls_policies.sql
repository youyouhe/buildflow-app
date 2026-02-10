-- ============================================
-- BuildFlow Community Feature - RLS Policies
-- All tables are in the 'community' schema
-- ============================================

-- ============================================
-- Profiles Table RLS
-- ============================================

-- Users can view all profiles
CREATE POLICY "Profiles are viewable by everyone"
ON community.profiles FOR SELECT
TO public
USING (true);

-- Service role can insert profiles (via trigger/API)
CREATE POLICY "Service role can insert profiles"
ON community.profiles FOR INSERT
TO service_role
WITH CHECK (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON community.profiles FOR UPDATE
TO authenticated
USING (github_id = (auth.jwt()->>'github_id')::INTEGER);

-- ============================================
-- Categories Table RLS
-- ============================================

-- Everyone can view active categories
CREATE POLICY "Active categories are viewable by everyone"
ON community.categories FOR SELECT
TO public
USING (is_active = true);

-- Service role manages categories
CREATE POLICY "Service role can manage categories"
ON community.categories FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- Community Projects Table RLS
-- ============================================

-- Public projects are viewable by everyone
CREATE POLICY "Public projects are viewable by everyone"
ON community.community_projects FOR SELECT
TO public
USING (visibility = 'public');

-- Private projects are viewable only by owner
CREATE POLICY "Private projects are viewable by owner"
ON community.community_projects FOR SELECT
TO authenticated
USING (
  visibility = 'private' AND
  profile_id = (
    SELECT id FROM community.profiles WHERE github_id = (auth.jwt()->>'github_id')::INTEGER
  )
);

-- Authenticated users can create projects
CREATE POLICY "Authenticated users can create projects"
ON community.community_projects FOR INSERT
TO authenticated
WITH CHECK (
  profile_id = (
    SELECT id FROM community.profiles WHERE github_id = (auth.jwt()->>'github_id')::INTEGER
  )
);

-- Owners can update their projects
CREATE POLICY "Owners can update own projects"
ON community.community_projects FOR UPDATE
TO authenticated
USING (
  profile_id = (
    SELECT id FROM community.profiles WHERE github_id = (auth.jwt()->>'github_id')::INTEGER
  )
)
WITH CHECK (
  profile_id = (
    SELECT id FROM community.profiles WHERE github_id = (auth.jwt()->>'github_id')::INTEGER
  )
);

-- Owners can delete their projects
CREATE POLICY "Owners can delete own projects"
ON community.community_projects FOR DELETE
TO authenticated
USING (
  profile_id = (
    SELECT id FROM community.profiles WHERE github_id = (auth.jwt()->>'github_id')::INTEGER
  )
);

-- ============================================
-- Project Likes Table RLS
-- ============================================

-- Everyone can see likes count (via aggregation)
CREATE POLICY "Likes are viewable by everyone"
ON community.project_likes FOR SELECT
TO public
USING (true);

-- Authenticated users can like projects
CREATE POLICY "Authenticated users can like projects"
ON community.project_likes FOR INSERT
TO authenticated
WITH CHECK (
  profile_id = (
    SELECT id FROM community.profiles WHERE github_id = (auth.jwt()->>'github_id')::INTEGER
  )
);

-- Users can unlike their own likes
CREATE POLICY "Users can unlike own projects"
ON community.project_likes FOR DELETE
TO authenticated
USING (
  profile_id = (
    SELECT id FROM community.profiles WHERE github_id = (auth.jwt()->>'github_id')::INTEGER
  )
);

-- ============================================
-- Project Downloads Table RLS
-- ============================================

-- Downloads are tracked by system
CREATE POLICY "Service role can insert downloads"
ON community.project_downloads FOR INSERT
TO service_role
WITH CHECK (true);

-- Users can view their own download history
CREATE POLICY "Users can view own downloads"
ON community.project_downloads FOR SELECT
TO authenticated
USING (
  profile_id = (
    SELECT id FROM community.profiles WHERE github_id = (auth.jwt()->>'github_id')::INTEGER
  )
);

-- Service role can view all downloads
CREATE POLICY "Service role can view all downloads"
ON community.project_downloads FOR SELECT
TO service_role
USING (true);

-- ============================================
-- Helper Functions
-- All functions are in the 'community' schema
-- ============================================

-- Function to increment view count
CREATE OR REPLACE FUNCTION community.increment_project_view(project_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE community.community_projects
  SET views_count = views_count + 1
  WHERE id = project_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment download count
CREATE OR REPLACE FUNCTION community.increment_project_download(project_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE community.community_projects
  SET downloads_count = downloads_count + 1
  WHERE id = project_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment likes count
CREATE OR REPLACE FUNCTION community.increment_likes_count(project_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE community.community_projects
  SET likes_count = likes_count + 1
  WHERE id = project_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement likes count
CREATE OR REPLACE FUNCTION community.decrement_likes_count(project_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE community.community_projects
  SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = project_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create profile from GitHub user data
CREATE OR REPLACE FUNCTION community.get_or_create_profile(
  p_github_id INTEGER,
  p_github_login VARCHAR(255),
  p_github_name VARCHAR,
  p_github_email VARCHAR,
  p_github_avatar_url TEXT,
  p_github_bio TEXT
)
RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Try to get existing profile
  SELECT id INTO v_profile_id FROM community.profiles WHERE github_id = p_github_id;

  -- If not found, create new profile
  IF NOT FOUND THEN
    INSERT INTO community.profiles (
      github_id,
      github_login,
      github_name,
      github_email,
      github_avatar_url,
      github_bio
    ) VALUES (
      p_github_id,
      p_github_login,
      p_github_name,
      p_github_email,
      p_github_avatar_url,
      p_github_bio
    ) RETURNING id INTO v_profile_id;
  ELSE
    -- Update existing profile with latest data
    UPDATE community.profiles SET
      github_login = p_github_login,
      github_name = p_github_name,
      github_email = p_github_email,
      github_avatar_url = p_github_avatar_url,
      github_bio = p_github_bio,
      updated_at = NOW()
    WHERE id = v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION community.increment_project_view TO anon;
GRANT EXECUTE ON FUNCTION community.increment_project_view TO authenticated;
GRANT EXECUTE ON FUNCTION community.increment_project_download TO anon;
GRANT EXECUTE ON FUNCTION community.increment_project_download TO authenticated;
GRANT EXECUTE ON FUNCTION community.increment_likes_count TO anon;
GRANT EXECUTE ON FUNCTION community.increment_likes_count TO authenticated;
GRANT EXECUTE ON FUNCTION community.decrement_likes_count TO anon;
GRANT EXECUTE ON FUNCTION community.decrement_likes_count TO authenticated;
GRANT EXECUTE ON FUNCTION community.get_or_create_profile TO authenticated;

-- ============================================
-- Triggers for updated_at timestamps
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION community.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION community.update_updated_at_column TO postgres;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON community.profiles
  FOR EACH ROW EXECUTE FUNCTION community.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON community.categories
  FOR EACH ROW EXECUTE FUNCTION community.update_updated_at_column();

CREATE TRIGGER update_community_projects_updated_at BEFORE UPDATE ON community.community_projects
  FOR EACH ROW EXECUTE FUNCTION community.update_updated_at_column();
