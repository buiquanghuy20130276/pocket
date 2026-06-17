// supabase/functions/parse-expense/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPENSE_KEYWORDS: Record<string, string[]> = {
  "Ăn uống": ["ăn", "cơm", "phở", "bún", "café", "coffee", "sáng", "trưa", "tối", "snack", "uống", "bánh", "tạp hóa"],
  "Di chuyển": ["grab", "xe", "xăng", "taxi", "bus", "gửi xe", "vé xe", "phí đi", "uber", "be"],
  "Mua sắm": ["mua", "shop", "quần", "áo", "giày", "túi", "mỹ phẩm", "son", "quà", "shopee", "lazada", "tiki"],
  "Sức khỏe": ["thuốc", "khám", "bệnh", "gym", "spa", "răng", "nha khoa", "thuốc tây", "bác sĩ"],
  "Giải trí": ["phim", "game", "nhạc", "sách", "karaoke", "cinema", "netflix", "spotify", "du lịch", "vui chơi"],
  "Chi phí khác": ["khác", "chuyển khoản", "nợ", "lì xì", "cho mượn"],
};

function parseAmountRegex(caption: string): { amount: number; currency: string } | null {
  // Regex to match formats like "10k", "10K", "10.5k", "45,000", "100 nghìn", "75000đ", "$5"
  const clean = caption.replace(/\s+/g, " ");
  
  // 1. Matches "10k", "10.5K", "100 nghìn", "75000đ", "75.000", etc.
  const regexVnd = /(\d[\d.,]*)\s*(k|K|nghìn|nghìn đồng|đồng|vnd|VND|₫|đ)/i;
  const matchVnd = clean.match(regexVnd);
  if (matchVnd) {
    let rawNum = matchVnd[1].replace(/,/g, "");
    if (rawNum.includes(".") && !rawNum.endsWith("k") && !rawNum.endsWith("K")) {
      // Handle "45.000" style decimal point as thousand separator in Vietnamese
      if (rawNum.split(".")[1].length === 3) {
        rawNum = rawNum.replace(/\./g, "");
      }
    }
    let amount = parseFloat(rawNum);
    const unit = matchVnd[2].toLowerCase();
    
    if (unit === "k") {
      amount *= 1000;
    } else if (unit === "nghìn" || unit === "nghìn đồng") {
      amount *= 1000;
    }
    
    // If it's less than 100 (like "50" meaning 50k), auto-scale if unit is empty but usually VND is > 1000
    if (amount > 0) {
      return { amount: Math.round(amount), currency: "VND" };
    }
  }

  // 2. Matches currency symbol first, like "$5", "$5.50", "VND 50000"
  const regexForeign = /(\$|USD|VND)\s*(\d[\d.,]*)/i;
  const matchForeign = clean.match(regexForeign);
  if (matchForeign) {
    const symbol = matchForeign[1].toUpperCase();
    const rawNum = matchForeign[2].replace(/,/g, "");
    const amount = parseFloat(rawNum);
    if (amount > 0) {
      return { amount, currency: symbol === "$" ? "USD" : symbol };
    }
  }

  // 3. Matches bare numbers that are large, e.g., "ăn trưa 45000"
  const regexBare = /\b(\d{4,9})\b/;
  const matchBare = clean.match(regexBare);
  if (matchBare) {
    const amount = parseInt(matchBare[1]);
    return { amount, currency: "VND" };
  }

  return null;
}

function classifyCategoryKeywords(caption: string): string {
  const lower = caption.toLowerCase();
  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return "Chi phí khác";
}

async function parseWithGemini(caption: string, apiKey: string): Promise<{ amount: number | null; category: string | null; currency: string | null; description: string | null } | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `Bạn là một trợ lý thông minh giúp bóc tách thông tin chi tiêu từ caption của người dùng.
Hãy phân tích caption tiếng Việt sau: "${caption}" và trích xuất thông tin chi tiêu.
Trả về một JSON object duy nhất theo cấu trúc sau (không kèm markdown, không viết chữ ngoài JSON):
{
  "amount": number_hoac_null, // Số tiền chi tiêu (ví dụ: 150000, không có dấu phẩy hoặc chấm)
  "currency": "VND" | "USD" | null, // Đơn vị tiền tệ
  "category": "Ăn uống" | "Di chuyển" | "Mua sắm" | "Sức khỏe" | "Giải trí" | "Chi phí khác" | null, // Chọn đúng phân loại phù hợp nhất
  "description": "mô tả ngắn gọn" | null // Ví dụ: "Ăn trưa", "Đi Grab"
}
Nếu caption KHÔNG chứa thông tin chi tiêu tiền bạc, hãy trả về các trường đều là null:
{
  "amount": null,
  "currency": null,
  "category": null,
  "description": null
}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });
    
    if (!response.ok) {
      console.error("Gemini API error status:", response.status);
      return null;
    }
    
    const result = await response.json();
    const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) return null;
    
    return JSON.parse(textResult.trim());
  } catch (err) {
    console.error("Error calling Gemini API:", err);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { post_id, caption, author_id, circle_id } = await req.json();

    if (!caption || typeof caption !== "string") {
      return new Response(JSON.stringify({ logged: false, reason: "No caption provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let amount: number | null = null;
    let currency = "VND";
    let category = "Chi phí khác";
    let description = caption;
    let isExpense = false;

    // 1. Try regex path first
    const regexResult = parseAmountRegex(caption);
    if (regexResult) {
      amount = regexResult.amount;
      currency = regexResult.currency;
      category = classifyCategoryKeywords(caption);
      isExpense = true;
      console.log(`Parsed using regex: Amount=${amount}, Currency=${currency}, Category=${category}`);
    } else {
      // 2. If regex fails, fallback to Gemini
      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      if (geminiApiKey) {
        console.log("Regex fallback triggered. Parsing with Gemini...");
        const aiResult = await parseWithGemini(caption, geminiApiKey);
        if (aiResult && aiResult.amount !== null && aiResult.amount > 0) {
          amount = aiResult.amount;
          currency = aiResult.currency || "VND";
          category = aiResult.category || "Chi phí khác";
          description = aiResult.description || caption;
          isExpense = true;
          console.log(`Parsed using Gemini: Amount=${amount}, Currency=${currency}, Category=${category}`);
        }
      }
    }

    if (!isExpense || amount === null) {
      return new Response(JSON.stringify({ logged: false, reason: "Caption is not an expense" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Find category_id for user
    let { data: categoryData } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("user_id", author_id)
      .eq("name", category)
      .maybeSingle();

    // If specific user category is missing, find default category or standard other
    if (!categoryData) {
      const { data: defaultCat } = await supabase
        .from("expense_categories")
        .select("id")
        .eq("name", category)
        .eq("is_default", true)
        .maybeSingle();
      categoryData = defaultCat;
    }

    // 4. Write to expenses table
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        user_id: author_id,
        post_id,
        circle_id,
        category_id: categoryData?.id || null,
        amount: Math.round(amount),
        currency,
        description,
        source: "auto",
      })
      .select()
      .single();

    if (expenseError) {
      throw expenseError;
    }

    // 5. Update post flag
    await supabase
      .from("posts")
      .update({ has_expense: true })
      .eq("id", post_id);

    // 6. Trigger FCM notification to author that their expense was logged
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          recipient_id: author_id,
          type: "expense_logged",
          title: "💸 Chi tiêu tự động đã lưu",
          body: `Ghi nhận: ${description} — ${amount.toLocaleString()} ${currency}`,
          data: {
            expense_id: expenseData.id,
            post_id,
            amount: amount.toString(),
            category,
          },
        }),
      });
    } catch (notifErr) {
      console.error("Failed to trigger FCM notification:", notifErr);
    }

    return new Response(
      JSON.stringify({
        logged: true,
        amount,
        currency,
        category,
        description,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in parse-expense:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
