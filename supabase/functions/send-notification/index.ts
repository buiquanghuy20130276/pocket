// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to sign JWT for Google OAuth2 using Web Crypto API
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwtHeader = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtClaim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Import private key
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pem = serviceAccount.private_key
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  const binaryKey = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Encode header and claim
  const encoder = new TextEncoder();
  const base64Header = btoa(JSON.stringify(jwtHeader)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const base64Claim = btoa(JSON.stringify(jwtClaim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signData = encoder.encode(`${base64Header}.${base64Claim}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, signData);
  
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${base64Header}.${base64Claim}.${base64Signature}`;

  // Exchange for access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to exchange JWT for token: ${errorBody}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { recipient_id, type, title, body, data } = await req.json();

    if (!recipient_id || !type) {
      return new Response(JSON.stringify({ error: "Missing recipient_id or type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Log notification in database
    const { error: dbError } = await supabase.from("notifications").insert({
      recipient_id,
      type,
      title,
      body,
      data,
    });

    if (dbError) throw dbError;

    // 2. Fetch user's FCM token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", recipient_id)
      .single();

    if (profileError || !profile?.fcm_token) {
      console.log(`Notification logged, but FCM token not found for user ${recipient_id}`);
      return new Response(JSON.stringify({ success: true, message: "Logged in DB, but FCM token missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Load Firebase Service Account
    const fcmServiceAccountEnv = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    if (!fcmServiceAccountEnv) {
      console.log("Notification logged, but FIREBASE_SERVICE_ACCOUNT_KEY env var not set");
      return new Response(JSON.stringify({ success: true, message: "Logged in DB, but FCM service account not set" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const serviceAccount = JSON.parse(fcmServiceAccountEnv);
    const projectId = serviceAccount.project_id;
    const accessToken = await getAccessToken(serviceAccount);

    // 4. Construct and send FCM Message
    const fcmMessage = {
      message: {
        token: profile.fcm_token,
        notification: type === "widget_refresh" ? undefined : {
          title,
          body,
        },
        apns: {
          payload: {
            aps: {
              "content-available": type === "widget_refresh" ? 1 : undefined,
              "mutable-content": 1,
              sound: "default",
            },
          },
        },
        data: {
          type,
          ...Object.keys(data || {}).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {} as Record<string, string>),
        },
      },
    };

    const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(fcmMessage),
    });

    if (!fcmResponse.ok) {
      const fcmErrorText = await fcmResponse.text();
      console.error("FCM API Response error:", fcmErrorText);
      return new Response(JSON.stringify({ success: false, error: fcmErrorText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    const fcmResult = await fcmResponse.json();
    return new Response(JSON.stringify({ success: true, messageId: fcmResult.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in send-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
