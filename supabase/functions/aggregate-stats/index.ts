// supabase/functions/aggregate-stats/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, date } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1; // 1-indexed

    // Format start and end date for SQL query
    const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    const endOfMonthDate = new Date(year, month, 0); // Last day of month
    const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(endOfMonthDate.getDate()).padStart(2, "0")}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch sum of expenses for the user in the target month
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user_id)
      .gte("expense_date", startOfMonth)
      .lte("expense_date", endOfMonth);

    if (expensesError) throw expensesError;

    const totalSpent = (expenses || []).reduce((sum, exp) => sum + Number(exp.amount), 0);

    // 2. Fetch user's preferred currency
    const { data: profile } = await supabase
      .from("profiles")
      .select("currency")
      .eq("id", user_id)
      .single();

    const currency = profile?.currency || "VND";

    // 3. Upsert budget period record
    const { data: budgetData, error: budgetError } = await supabase
      .from("budget_periods")
      .upsert(
        {
          user_id,
          period_start: startOfMonth,
          period_end: endOfMonth,
          total_spent: totalSpent,
          currency,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,period_start" }
      )
      .select()
      .single();

    if (budgetError) throw budgetError;

    // 4. Check budget limit alerts
    if (budgetData.total_budget && budgetData.total_budget > 0) {
      const budgetLimit = Number(budgetData.total_budget);
      const ratio = totalSpent / budgetLimit;

      if (ratio >= 1.0) {
        // Send 100% budget alert notification
        await supabase.functions.invoke("send-notification", {
          body: {
            recipient_id: user_id,
            type: "budget_alert_100",
            title: "🚨 Ngân sách chi tiêu vượt giới hạn",
            body: `Bạn đã chi ${totalSpent.toLocaleString()} ${currency}, vượt ngân sách định mức (${budgetLimit.toLocaleString()} ${currency})!`,
            data: { total_spent: totalSpent.toString(), total_budget: budgetLimit.toString() },
          },
        });
      } else if (ratio >= 0.8) {
        // Send 80% budget alert notification
        await supabase.functions.invoke("send-notification", {
          body: {
            recipient_id: user_id,
            type: "budget_alert_80",
            title: "⚠️ Ngân sách sắp đạt giới hạn",
            body: `Bạn đã sử dụng ${Math.round(ratio * 100)}% ngân sách định mức (${totalSpent.toLocaleString()} / ${budgetLimit.toLocaleString()} ${currency}).`,
            data: { total_spent: totalSpent.toString(), total_budget: budgetLimit.toString() },
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id,
        period_start: startOfMonth,
        total_spent: totalSpent,
        currency,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in aggregate-stats:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
