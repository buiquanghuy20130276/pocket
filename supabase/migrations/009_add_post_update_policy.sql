-- Migration 009: Add update policy for posts table
-- Allows users to edit their own posts

CREATE POLICY "allow_update_own_posts" ON public.posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
