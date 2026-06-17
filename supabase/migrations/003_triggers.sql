-- =============================================
-- DATABASE SCHEMA MIGRATION: 003_triggers.sql
-- =============================================

-- =============================================
-- TRIGGER: SYNC BUDGET PERIOD SPENT
-- =============================================
CREATE OR REPLACE FUNCTION public.sync_budget_period_spent()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_date DATE;
  v_amount BIGINT;
  v_currency TEXT;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- 1. Handle OLD values for UPDATE or DELETE
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
    v_user_id := OLD.user_id;
    v_date := OLD.expense_date;
    v_amount := OLD.amount;
    v_currency := OLD.currency;
    v_start_date := date_trunc('month', v_date)::DATE;

    UPDATE public.budget_periods
    SET total_spent = COALESCE(total_spent, 0) - v_amount,
        updated_at = NOW()
    WHERE user_id = v_user_id AND period_start = v_start_date;
  END IF;

  -- 2. Handle NEW values for INSERT or UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_user_id := NEW.user_id;
    v_date := NEW.expense_date;
    v_amount := NEW.amount;
    v_currency := NEW.currency;
    v_start_date := date_trunc('month', v_date)::DATE;
    v_end_date := (date_trunc('month', v_date) + INTERVAL '1 month - 1 day')::DATE;

    INSERT INTO public.budget_periods (user_id, period_start, period_end, total_spent, total_budget, currency, updated_at)
    VALUES (v_user_id, v_start_date, v_end_date, v_amount, 10000000, v_currency, NOW()) -- Default 10M VND budget
    ON CONFLICT (user_id, period_start)
    DO UPDATE SET
      total_spent = COALESCE(public.budget_periods.total_spent, 0) + EXCLUDED.total_spent,
      updated_at = NOW();
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger for Expenses Table
CREATE OR REPLACE TRIGGER trg_sync_budget_on_expense
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.sync_budget_period_spent();


-- =============================================
-- TRIGGER: AUTO CREATE PROFILE & SEED CATEGORIES
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
  v_avatar_url TEXT;
  v_phone TEXT;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(md5(random()::text), 1, 8));
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', 'User');
  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';
  v_phone := NEW.phone;

  -- Ensure username uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := 'user_' || substr(md5(random()::text), 1, 8);
  END LOOP;

  -- Insert profile
  INSERT INTO public.profiles (id, username, display_name, avatar_url, phone, currency, created_at, updated_at)
  VALUES (NEW.id, v_username, v_display_name, v_avatar_url, v_phone, 'VND', NOW(), NOW());
  
  -- Seed standard category limits for this user
  INSERT INTO public.expense_categories (user_id, name, icon, color, budget_limit, is_default)
  VALUES
    (NEW.id, 'Ăn uống', 'restaurant', '#FF9500', 5000000, false),
    (NEW.id, 'Di chuyển', 'car', '#5AC8FA', 1000000, false),
    (NEW.id, 'Mua sắm', 'bag-handle', '#FF2D55', 3000000, false),
    (NEW.id, 'Sức khỏe', 'heart', '#4CD964', 1000000, false),
    (NEW.id, 'Giải trí', 'game-controller', '#5856D6', 1500000, false),
    (NEW.id, 'Chi phí khác', 'ellipsis-horizontal-circle', '#8E8E93', 1000000, false);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
