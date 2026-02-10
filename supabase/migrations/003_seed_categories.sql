-- ============================================
-- BuildFlow Community Feature - Seed Categories
-- ============================================

INSERT INTO community.categories (slug, name, description, icon, color, sort_order) VALUES
  ('landing-pages', 'Landing Pages', 'Marketing and promotional landing pages', 'layout', '#3b82f6', 1),
  ('portfolio', 'Portfolio', 'Personal portfolio and showcase websites', 'user', '#8b5cf6', 2),
  ('ecommerce', 'E-Commerce', 'Online stores and product catalogs', 'shopping-cart', '#10b981', 3),
  ('blog', 'Blog', 'Content-focused websites and blogs', 'file-text', '#f59e0b', 4),
  ('dashboards', 'Dashboards', 'Admin panels and analytics dashboards', 'bar-chart', '#ef4444', 5),
  ('business', 'Business', 'Corporate and business websites', 'building', '#6366f1', 6),
  ('creative', 'Creative', 'Artistic and creative projects', 'palette', '#ec4899', 7),
  ('education', 'Education', 'Educational content and courses', 'book-open', '#14b8a6', 8),
  ('social', 'Social', 'Social media and community platforms', 'users', '#f97316', 9),
  ('other', 'Other', 'Projects that don''t fit other categories', 'more-horizontal', '#6b7280', 10);
