-- Migration 008: Enable Supabase Realtime for tables
-- This allows the client to receive real-time updates when posts, expenses, or notifications are created.

-- Add public.posts to the realtime publication
alter publication supabase_realtime add table public.posts;

-- Add public.expenses to the realtime publication
alter publication supabase_realtime add table public.expenses;

-- Add public.notifications to the realtime publication
alter publication supabase_realtime add table public.notifications;
