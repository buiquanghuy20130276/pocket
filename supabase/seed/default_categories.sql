-- =============================================
-- SEED DATA: default_categories.sql
-- =============================================

-- Seed system default categories (accessible to all users)
INSERT INTO public.expense_categories (id, user_id, name, icon, color, budget_limit, is_default)
VALUES
  ('a0e0a0e0-0000-0000-0000-000000000001', NULL, 'Ăn uống', 'restaurant', '#FF9500', NULL, TRUE),
  ('a0e0a0e0-0000-0000-0000-000000000002', NULL, 'Di chuyển', 'car', '#5AC8FA', NULL, TRUE),
  ('a0e0a0e0-0000-0000-0000-000000000003', NULL, 'Mua sắm', 'bag-handle', '#FF2D55', NULL, TRUE),
  ('a0e0a0e0-0000-0000-0000-000000000004', NULL, 'Sức khỏe', 'heart', '#4CD964', NULL, TRUE),
  ('a0e0a0e0-0000-0000-0000-000000000005', NULL, 'Giải trí', 'game-controller', '#5856D6', NULL, TRUE),
  ('a0e0a0e0-0000-0000-0000-000000000006', NULL, 'Chi phí khác', 'ellipsis-horizontal-circle', '#8E8E93', NULL, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  is_default = TRUE;
