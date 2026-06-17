# 📱 SnapLedger — iOS App Build Plan
> A Locket-inspired photo sharing app with integrated expense tracking, powered by Supabase + FCM

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Schema (Supabase)](#4-database-schema-supabase)
5. [Core Features Breakdown](#5-core-features-breakdown)
6. [AI Expense Parsing Engine](#6-ai-expense-parsing-engine)
7. [Push Notification Strategy (FCM)](#7-push-notification-strategy-fcm)
8. [iOS Widget Implementation](#8-ios-widget-implementation)
9. [Project Structure](#9-project-structure)
10. [Milestones & Sprint Plan](#10-milestones--sprint-plan)
11. [API Endpoints Design](#11-api-endpoints-design)
12. [Security & Privacy](#12-security--privacy)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & CI/CD](#14-deployment--cicd)

---

## 1. Project Overview

**App Name:** SnapLedger

**Tagline:** *Share moments. Track money.*

SnapLedger combines the intimacy of Locket-style photo widgets with a lightweight expense management system. Users share photos with their close circle (friends, family, partner) directly on the iOS Home Screen widget. When a post caption contains a spending message (e.g., `"Ăn sáng 10k"` or `"Coffee 45,000"`), the app automatically parses and logs the expense, updating personal or shared budget balances in real time.

### What It Does (vs. Locket)

| Feature | Locket | SnapLedger |
|---|---|---|
| Home Screen Widget | ✅ | ✅ |
| Photo Sharing to Close Circle | ✅ | ✅ |
| Real-time Chat | ✅ | ❌ (removed) |
| Push Notifications | ✅ | ✅ (FCM) |
| Expense Parsing from Caption | ❌ | ✅ |
| Budget & Balance Tracking | ❌ | ✅ |
| Monthly / Quarterly / Yearly Stats | ❌ | ✅ |
| Shared Group Fund | ❌ | ✅ |

---

## 2. Technology Stack

### Frontend (iOS)
| Layer | Technology | Reason |
|---|---|---|
| Language | Swift 5.9+ | Native performance, latest concurrency (async/await) |
| UI Framework | SwiftUI | Declarative, widget-friendly, modern iOS |
| Widget Extension | WidgetKit | Required for Home Screen & Lock Screen widgets |
| Image Handling | SDWebImageSwiftUI | Efficient async image loading & caching |
| Camera/Photo | AVFoundation + PhotosUI | Native camera capture and library picker |
| State Management | TCA (The Composable Architecture) | Predictable, testable, scalable state |
| Navigation | SwiftUI NavigationStack | iOS 16+ stack-based navigation |

### Backend & Database
| Layer | Technology | Reason |
|---|---|---|
| Database | Supabase (PostgreSQL) | Real-time subscriptions, Auth, Storage built-in |
| Auth | Supabase Auth | Phone/OTP + Apple Sign-In + Google Sign-In |
| File Storage | Supabase Storage | S3-compatible photo storage with CDN |
| Real-time | Supabase Realtime (Channels) | Live widget photo updates via WebSocket |
| Edge Functions | Supabase Edge Functions (Deno) | Expense parsing, notification triggers |
| Push Notifications | Firebase Cloud Messaging (FCM) | Reliable iOS/Android cross-platform push |

### AI / Parsing
| Layer | Technology | Reason |
|---|---|---|
| Expense NLP | Regex + Rule Engine (on-device) | Fast, offline-capable for simple patterns |
| Ambiguous Captions | OpenAI GPT-4o-mini via Edge Function | Handles complex or multilingual captions |
| Currency Detection | On-device locale-aware parser | VND, USD, etc. without API call |

### DevOps
| Tool | Purpose |
|---|---|
| Xcode 15+ | IDE, build, archive |
| Fastlane | Automated build, test, deploy |
| GitHub Actions | CI/CD pipeline |
| TestFlight | Beta distribution |
| Sentry | Crash reporting & performance |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        iOS App                              │
│                                                             │
│  ┌──────────┐   ┌────────────┐   ┌─────────────────────┐   │
│  │  Camera  │   │  WidgetKit │   │  Expense Dashboard  │   │
│  │  Screen  │   │  Extension │   │  (Stats & Charts)   │   │
│  └────┬─────┘   └─────┬──────┘   └──────────┬──────────┘   │
│       │               │                      │              │
│  ┌────▼───────────────▼──────────────────────▼──────────┐   │
│  │              TCA Store / App State                    │   │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │         Supabase Swift Client + FCM SDK               │  │
│  └────────────────────────┬──────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTPS / WebSocket
┌───────────────────────────▼──────────────────────────────────┐
│                      Supabase Cloud                           │
│                                                               │
│  ┌─────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │  PostgreSQL │  │    Realtime   │  │   Supabase Storage │  │
│  │  (RLS + DB) │  │   Channels    │  │   (Photo CDN)      │  │
│  └──────┬──────┘  └───────┬───────┘  └────────────────────┘  │
│         │                 │                                    │
│  ┌──────▼─────────────────▼──────────────────────────────┐    │
│  │              Edge Functions (Deno)                     │    │
│  │   • post_created trigger → parse_expense()            │    │
│  │   • send_fcm_notification()                           │    │
│  │   • aggregate_monthly_stats()                         │    │
│  └──────────────────────────┬──────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│                   Firebase Cloud Messaging                     │
│                  (Push delivery to APNs)                       │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema (Supabase)

### 4.1 Tables

```sql
-- =============================================
-- USERS
-- =============================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  phone         TEXT,
  fcm_token     TEXT,                        -- FCM device token
  currency      TEXT DEFAULT 'VND',          -- preferred currency
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FRIEND CIRCLES (Groups)
-- =============================================
CREATE TABLE circles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  owner_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code   TEXT UNIQUE DEFAULT substr(md5(random()::TEXT), 1, 8),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE circle_members (
  circle_id     UUID REFERENCES circles(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role          TEXT DEFAULT 'member',       -- 'owner' | 'member'
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY   (circle_id, user_id)
);

-- =============================================
-- POSTS (Photos with captions)
-- =============================================
CREATE TABLE posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id     UUID REFERENCES circles(id) ON DELETE CASCADE,
  photo_url     TEXT NOT NULL,               -- Supabase Storage URL
  thumbnail_url TEXT,                        -- Compressed for widget
  caption       TEXT,
  has_expense   BOOLEAN DEFAULT FALSE,       -- set by Edge Function
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EXPENSE CATEGORIES
-- =============================================
CREATE TABLE expense_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,               -- "Food & Drink", "Transport", etc.
  icon          TEXT,                        -- SF Symbol name
  color         TEXT,                        -- hex color
  budget_limit  BIGINT,                      -- monthly limit in base currency unit
  is_default    BOOLEAN DEFAULT FALSE
);

-- Insert default categories (seeded per user on registration)
-- Food & Drink, Transport, Shopping, Health, Entertainment, Other

-- =============================================
-- EXPENSES (Auto-created from post captions)
-- =============================================
CREATE TABLE expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id       UUID REFERENCES posts(id) ON DELETE SET NULL,
  circle_id     UUID REFERENCES circles(id) ON DELETE SET NULL,
  category_id   UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount        BIGINT NOT NULL,             -- stored in smallest unit (e.g., đồng)
  currency      TEXT DEFAULT 'VND',
  description   TEXT,                        -- parsed or user-edited
  source        TEXT DEFAULT 'auto',         -- 'auto' | 'manual'
  expense_date  DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BUDGET PERIODS (Monthly snapshots)
-- =============================================
CREATE TABLE budget_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,               -- first day of month
  period_end    DATE NOT NULL,               -- last day of month
  total_budget  BIGINT,                      -- user-set monthly budget
  total_spent   BIGINT DEFAULT 0,            -- auto-aggregated
  currency      TEXT DEFAULT 'VND',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS LOG
-- =============================================
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,               -- 'new_post' | 'expense_logged' | 'budget_alert'
  title         TEXT,
  body          TEXT,
  data          JSONB,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Row Level Security (RLS) Policies

```sql
-- Profiles: users can only read/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Posts: circle members can read posts in their circles
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_circle_posts" ON posts FOR SELECT
  USING (circle_id IN (
    SELECT circle_id FROM circle_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "insert_own_posts" ON posts FOR INSERT
  WITH CHECK (author_id = auth.uid());

-- Expenses: users can only see their own expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_expenses" ON expenses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "insert_own_expenses" ON expenses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "update_own_expenses" ON expenses FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "delete_own_expenses" ON expenses FOR DELETE USING (user_id = auth.uid());
```

### 4.3 Database Functions & Triggers

```sql
-- Trigger: auto-update total_spent in budget_periods after expense insert/update/delete
CREATE OR REPLACE FUNCTION update_budget_period_spent()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_periods (user_id, period_start, period_end, total_spent, currency)
  VALUES (
    NEW.user_id,
    date_trunc('month', NEW.expense_date)::DATE,
    (date_trunc('month', NEW.expense_date) + INTERVAL '1 month - 1 day')::DATE,
    NEW.amount,
    NEW.currency
  )
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    total_spent = budget_periods.total_spent + NEW.amount,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_budget_on_expense
AFTER INSERT ON expenses
FOR EACH ROW EXECUTE FUNCTION update_budget_period_spent();
```

---

## 5. Core Features Breakdown

### 5.1 Authentication Flow

```
App Launch
    │
    ├── Has saved session? ──── YES ──→ Refresh Supabase session → Home
    │
    └── NO
         │
         ├── Phone Number + OTP (Supabase SMS Auth via Twilio)
         ├── Sign in with Apple (required for App Store)
         └── Sign in with Google
                  │
                  └── First login? → Onboarding → Create profile → Create/Join Circle
```

### 5.2 Post Creation Flow

```
Tap Camera Button
    │
    ├── Camera Capture (AVFoundation)
    │       └── Photo taken → Preview screen
    │
    ├── Caption input (keyboard appears)
    │       └── Optional: type expense description
    │
    └── Tap "Send"
            │
            ├── Upload photo to Supabase Storage (posts/{circle_id}/{uuid}.jpg)
            ├── Insert row into posts table
            ├── Edge Function trigger fires: parse_expense()
            │       └── See Section 6
            └── Realtime event broadcast to circle members
                    └── Widget auto-refreshes via WidgetKit Timeline
```

### 5.3 Home Screen Widget

Three widget sizes supported:

- **Small (2×2):** Latest photo only, fullscreen
- **Medium (4×2):** Latest photo + sender name + timestamp
- **Large (4×4):** Latest photo + caption + sender name

Widget data flow:
1. App group container (`group.com.yourname.snapledger`) shared between main app and widget extension
2. On new post received (Realtime or background push), download thumbnail + write to App Group UserDefaults
3. WidgetKit `TimelineProvider` reads from App Group and renders
4. Widget tap → deeplink into app to full post view

### 5.4 Expense Dashboard

#### Main Balance Screen
- Current month total spent vs. budget (ring progress chart)
- Quick-add manual expense button
- Recent expense list (last 5 items, each linked to its post)
- Category breakdown (horizontal bar chart)

#### Statistics Screen
Three tabs: **Monthly | Quarterly | Yearly**

Each tab shows:
- Total spent for period
- Category pie chart
- Daily/weekly spend trend line chart
- Top 3 categories with % of total
- Budget vs. actual comparison (grouped bar chart)

Charts built with **Swift Charts** (native, no third-party library needed).

#### Expense Detail Screen
- Linked post photo (tap to view full post)
- Category (editable)
- Amount (editable)
- Date (editable)
- Description (editable)
- Delete button

---

## 6. AI Expense Parsing Engine

This is the core differentiator feature. Triggered as a Supabase Edge Function on every post insert.

### 6.1 Parsing Pipeline

```
Post caption received
        │
        ▼
Step 1: Regex pre-check
    Pattern: /(\d[\d.,]*)\s*(k|K|nghìn|nghìn đồng|đồng|vnd|VND|₫|\$|USD)?/
    - Match found? → Fast path (no AI needed)
    - No match? → AI path
        │
        ▼
Step 2 (Fast Path): Amount normalization
    - "10k"   → 10,000 VND
    - "10K"   → 10,000 VND
    - "10.5k" → 10,500 VND
    - "45000" → 45,000 VND
    - "45,000"→ 45,000 VND
    - "$5"    → 5 USD (converted if circle uses VND)
        │
        ▼
Step 3: Category classification (keyword matching)
    Keywords → Category mapping:
    ├── [ăn, cơm, phở, bún, sáng, trưa, tối, cafe, coffee, trà, snack] → Food & Drink
    ├── [grab, xe, xăng, taxi, bus, gửi xe] → Transport
    ├── [mua, shop, quần, áo, giày, mỹ phẩm] → Shopping
    ├── [thuốc, bệnh viện, khám, gym] → Health
    └── [phim, game, nhạc, sách] → Entertainment
    └── default → Other
        │
        ▼
Step 4 (AI Path): Gemini fallback (ambiguous captions)
    Prompt: "Extract expense amount and category from this Vietnamese caption: {caption}.
             Return JSON: {amount: number, currency: string, category: string, description: string}.
             If no expense found return null."
        │
        ▼
Step 5: Write to expenses table
    - user_id = post.author_id
    - post_id = post.id
    - amount = parsed amount
    - category_id = matched category
    - source = 'auto'
    - Update post.has_expense = TRUE
        │
        ▼
Step 6: Trigger FCM notification to author
    "💸 Expense logged: {description} — {amount} VND"
```

### 6.2 Edge Function Code (Supabase Deno)

```typescript
// supabase/functions/parse-expense/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const EXPENSE_KEYWORDS: Record<string, string[]> = {
  "Ăn uống": ["ăn", "cơm", "phở", "bún", "café", "coffee", "sáng", "trưa", "tối", "snack", "uống"],
  "Di chuyển": ["grab", "xe", "xăng", "taxi", "bus", "gửi xe", "đi"],
  "Mua sắm": ["mua", "shop", "quần", "áo", "giày", "túi"],
  "Sức khỏe": ["thuốc", "khám", "bệnh", "gym", "spa"],
  "Giải trí": ["phim", "game", "nhạc", "sách", "karaoke"],
  "Tiền nhà": ["nhà", "thuê"],
  "Chi phí khác": ["khác"],// can add category from user input  
};

function parseAmount(caption: string): number | null {
  const match = caption.match(/(\d[\d.,]*)(\s*)(k|K|nghìn|đồng|vnd|₫|\$)?/i);
  if (!match) return null;
  let amount = parseFloat(match[1].replace(/,/g, ""));
  const unit = (match[3] || "").toLowerCase();
  if (unit === "k") amount *= 1000;
  return amount;
}

function classifyCategory(caption: string): string {
  const lower = caption.toLowerCase();
  for (const [category, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return "Other";
}

serve(async (req) => {
  const { post_id, caption, author_id, circle_id } = await req.json();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const amount = parseAmount(caption);
  if (!amount) return new Response(JSON.stringify({ logged: false }), { status: 200 });

  const category = classifyCategory(caption);

  // Get category_id for user
  const { data: catData } = await supabase
    .from("expense_categories")
    .select("id")
    .eq("user_id", author_id)
    .eq("name", category)
    .single();

  await supabase.from("expenses").insert({
    user_id: author_id,
    post_id,
    circle_id,
    category_id: catData?.id,
    amount: Math.round(amount),
    currency: "VND",
    description: caption,
    source: "auto",
  });

  await supabase.from("posts").update({ has_expense: true }).eq("id", post_id);

  return new Response(JSON.stringify({ logged: true, amount, category }), { status: 200 });
});
```

---

## 7. Push Notification Strategy (FCM)

### 7.1 Notification Types

| Type | Trigger | Title | Body |
|---|---|---|---|
| `new_post` | Someone in circle posts | "📸 {sender}" | "{sender} just shared a photo!" |
| `expense_logged` | Caption auto-parsed | "💸 Expense Logged" | "{description} — {amount} VND" |
| `budget_alert_80` | Spent ≥ 80% of budget | "⚠️ Budget Alert" | "You've used 80% of your {category} budget" |
| `budget_alert_100` | Spent = 100% of budget | "🚨 Budget Exceeded" | "You've exceeded your {category} budget" |
| `widget_refresh` | New post available | Silent push | `content-available: 1` (triggers widget refresh) |

### 7.2 FCM Integration Architecture

```
Supabase Edge Function (post_created)
        │
        └── POST https://fcm.googleapis.com/v1/projects/{project}/messages:send
              Authorization: Bearer {OAuth2 token from service account}
              Body: {
                message: {
                  token: recipient_fcm_token,
                  notification: { title, body },
                  apns: {
                    payload: {
                      aps: {
                        "content-available": 1,   // for widget silent push
                        "mutable-content": 1       // for rich notifications
                      }
                    }
                  },
                  data: { type, post_id, amount }
                }
              }
```

### 7.3 iOS FCM Setup

```swift
// AppDelegate.swift
import FirebaseMessaging
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate, MessagingDelegate, UNUserNotificationCenterDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        requestNotificationPermission(application)
        return true
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        // Save token to Supabase profiles table
        Task { await SupabaseManager.shared.updateFCMToken(token) }
    }

    // Handle silent push → trigger WidgetKit refresh
    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        if userInfo["type"] as? String == "widget_refresh" {
            WidgetCenter.shared.reloadAllTimelines()
        }
        completionHandler(.newData)
    }
}
```

---

## 8. iOS Widget Implementation

### 8.1 Widget Data Model

```swift
// Shared via App Group
struct WidgetEntry: TimelineEntry {
    let date: Date
    let photoURL: URL?
    let senderName: String
    let caption: String?
    let photoData: Data?           // cached image bytes
}

struct WidgetProvider: TimelineProvider {
    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        // Read from App Group shared container
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourname.snapledger")!
        let cachedData = sharedDefaults.data(forKey: "latestPostPhotoData")
        let senderName = sharedDefaults.string(forKey: "latestPostSender") ?? "Someone"
        let caption = sharedDefaults.string(forKey: "latestPostCaption")

        let entry = WidgetEntry(
            date: .now,
            photoURL: nil,
            senderName: senderName,
            caption: caption,
            photoData: cachedData
        )
        // Refresh every 15 minutes as fallback (silent push handles real-time)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}
```

### 8.2 Widget View (SwiftUI)

```swift
struct SnapLedgerWidgetView: View {
    var entry: WidgetProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Background photo
            if let data = entry.photoData, let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                Rectangle().fill(Color.gray.opacity(0.3))
            }

            // Gradient overlay
            LinearGradient(
                colors: [.clear, .black.opacity(0.6)],
                startPoint: .center, endPoint: .bottom
            )

            // Caption & sender (medium/large only)
            if family != .systemSmall {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.senderName)
                        .font(.caption.bold())
                        .foregroundColor(.white)
                    if let caption = entry.caption {
                        Text(caption)
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.8))
                            .lineLimit(2)
                    }
                }
                .padding(10)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .widgetURL(URL(string: "snapledger://open-latest-post"))
    }
}
```

---

## 9. Project Structure

```
SnapLedger/
├── SnapLedger/                        # Main app target
│   ├── App/
│   │   ├── SnapLedgerApp.swift
│   │   └── AppDelegate.swift
│   ├── Features/
│   │   ├── Auth/
│   │   │   ├── AuthFeature.swift      # TCA Feature
│   │   │   ├── LoginView.swift
│   │   │   └── OnboardingView.swift
│   │   ├── Camera/
│   │   │   ├── CameraFeature.swift
│   │   │   ├── CameraView.swift
│   │   │   └── PostPreviewView.swift
│   │   ├── Feed/
│   │   │   ├── FeedFeature.swift
│   │   │   └── FeedView.swift
│   │   ├── Expense/
│   │   │   ├── ExpenseFeature.swift
│   │   │   ├── ExpenseDashboardView.swift
│   │   │   ├── ExpenseDetailView.swift
│   │   │   ├── ExpenseAddView.swift
│   │   │   └── Statistics/
│   │   │       ├── MonthlyStatsView.swift
│   │   │       ├── QuarterlyStatsView.swift
│   │   │       └── YearlyStatsView.swift
│   │   ├── Circle/
│   │   │   ├── CircleFeature.swift
│   │   │   ├── CircleView.swift
│   │   │   └── InviteView.swift
│   │   └── Settings/
│   │       ├── SettingsFeature.swift
│   │       ├── SettingsView.swift
│   │       ├── BudgetSettingsView.swift
│   │       └── CategorySettingsView.swift
│   ├── Core/
│   │   ├── Supabase/
│   │   │   ├── SupabaseManager.swift
│   │   │   ├── PostRepository.swift
│   │   │   ├── ExpenseRepository.swift
│   │   │   └── ProfileRepository.swift
│   │   ├── Notifications/
│   │   │   ├── NotificationManager.swift
│   │   │   └── FCMTokenManager.swift
│   │   ├── Models/
│   │   │   ├── Post.swift
│   │   │   ├── Expense.swift
│   │   │   ├── Profile.swift
│   │   │   ├── Circle.swift
│   │   │   └── BudgetPeriod.swift
│   │   └── Extensions/
│   │       ├── Color+Hex.swift
│   │       ├── Date+Period.swift
│   │       └── Double+Currency.swift
│   └── Resources/
│       ├── Assets.xcassets
│       ├── GoogleService-Info.plist
│       └── Localizable.strings
│
├── SnapLedgerWidget/                  # Widget Extension target
│   ├── SnapLedgerWidget.swift
│   ├── WidgetProvider.swift
│   ├── WidgetViews/
│   │   ├── SmallWidgetView.swift
│   │   ├── MediumWidgetView.swift
│   │   └── LargeWidgetView.swift
│   └── SharedModels/
│       └── WidgetEntry.swift
│
├── supabase/
│   ├── functions/
│   │   ├── parse-expense/index.ts
│   │   ├── send-notification/index.ts
│   │   └── aggregate-stats/index.ts
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_triggers.sql
│   └── seed/
│       └── default_categories.sql
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── fastlane/
│   ├── Fastfile
│   └── Appfile
│
└── README.md
```

---

## 10. Milestones & Sprint Plan

> Total estimated timeline: **16 weeks** (4 months) for a solo developer or small team of 2.

### Phase 1 — Foundation (Weeks 1–3)

| Task | Duration |
|---|---|
| Xcode project setup, targets, App Groups | 1 day |
| Supabase project setup, schema migrations, RLS | 2 days |
| Supabase Auth (Phone OTP + Apple Sign-In) | 3 days |
| Profile creation & onboarding flow | 2 days |
| Circle creation & invite code flow | 2 days |
| Basic navigation shell (TCA + NavigationStack) | 2 days |

**Deliverable:** User can sign up, create a profile, and join/create a circle.

---

### Phase 2 — Core Photo Sharing (Weeks 4–6)

| Task | Duration |
|---|---|
| Camera capture (AVFoundation) + gallery picker | 3 days |
| Photo upload to Supabase Storage with compression | 2 days |
| Post insertion + Realtime subscription | 2 days |
| Basic feed view showing circle posts | 2 days |
| WidgetKit small widget showing latest photo | 3 days |
| Silent push → Widget refresh flow | 2 days |

**Deliverable:** Users can share photos; widget updates on new posts.

---

### Phase 3 — Expense Engine (Weeks 7–10)

| Task | Duration |
|---|---|
| Expense parsing Edge Function (regex + keyword) | 3 days |
| GPT-4o-mini integration for ambiguous captions | 2 days |
| Auto-insert to `expenses` table + post flag | 1 day |
| Expense Dashboard (balance, categories, recent) | 4 days |
| Manual expense add/edit/delete | 2 days |
| Budget settings (monthly limit per category) | 2 days |
| Budget period auto-aggregation trigger | 2 days |

**Deliverable:** Expense auto-logging works; users can view their balance.

---

### Phase 4 — Statistics & Analytics (Weeks 11–12)

| Task | Duration |
|---|---|
| Monthly stats view (Swift Charts) | 3 days |
| Quarterly stats view | 2 days |
| Yearly stats view | 2 days |
| Category breakdown pie/bar charts | 2 days |
| Export data as CSV (optional) | 1 day |

**Deliverable:** Full statistics views across all time periods.

---

### Phase 5 — Push Notifications (Weeks 13–14)

| Task | Duration |
|---|---|
| Firebase project setup + APNs certificate | 1 day |
| FCM SDK integration in iOS app | 1 day |
| FCM token save to Supabase on login | 1 day |
| send-notification Edge Function | 2 days |
| Budget alert notifications (80% / 100%) | 2 days |
| New post notification with deep link | 2 days |
| In-app notification bell + unread count | 2 days |

**Deliverable:** All notification types working end-to-end.

---

### Phase 6 — Polish & Launch Prep (Weeks 15–16)

| Task | Duration |
|---|---|
| Dark mode support | 1 day |
| Haptic feedback throughout app | 0.5 days |
| App icon + splash screen design | 1 day |
| Localization (Vietnamese + English) | 2 days |
| Sentry crash reporting integration | 1 day |
| App Store screenshots & metadata | 1 day |
| TestFlight beta testing | 3 days |
| App Store submission | 2 days |

**Deliverable:** App submitted to App Store.

---

## 11. API Endpoints Design

All data access goes through Supabase client SDK (auto-generated REST + Realtime). Edge Functions handle business logic.

### Edge Functions

| Endpoint | Method | Description |
|---|---|---|
| `/functions/v1/parse-expense` | POST | Parse caption, log expense, update post flag |
| `/functions/v1/send-notification` | POST | Send FCM push to one or multiple users |
| `/functions/v1/aggregate-stats` | POST | Recompute budget_periods totals (cron job) |
| `/functions/v1/on-post-created` | POST | Webhook: called by DB trigger on post insert |

### Supabase Realtime Channels

| Channel | Event | Payload |
|---|---|---|
| `circle:{circle_id}` | `INSERT` on `posts` | Full post row |
| `expenses:{user_id}` | `INSERT` on `expenses` | Full expense row |
| `notifications:{user_id}` | `INSERT` on `notifications` | Notification row |

---

## 12. Security & Privacy

- **RLS on all tables:** Users can only read/write their own data; circle members can read shared posts only.
- **Supabase Storage:** Bucket `posts` is private; signed URLs with 1-hour expiry used for all photo access.
- **FCM tokens:** Stored in `profiles` table, only accessible by the authenticated user and service role.
- **Expense data:** Never shared with circle members — purely personal, even when linked to a circle post.
- **API keys:** Never hardcoded in iOS; retrieved from environment at build time via Xcode Config files.
- **App Transport Security:** All traffic HTTPS only.
- **Photo permissions:** Camera and photo library access requested with clear usage descriptions (NSCameraUsageDescription, NSPhotoLibraryUsageDescription).
- **GDPR/PDPA compliance:** Account deletion permanently removes all user data (cascading deletes on `profiles`).

---

## 13. Testing Strategy

### Unit Tests
- Expense parsing functions (regex edge cases: "10k", "10.5K", "10,000", "10 nghìn")
- Currency normalization logic
- Category keyword matching
- Date period calculations (monthly/quarterly/yearly bounds)

### Integration Tests
- Supabase insert + trigger → budget_period updated correctly
- Edge function: parse-expense returns correct category for various captions
- FCM token registration and update flow

### UI Tests (XCTest)
- Post creation flow (camera → caption → upload)
- Expense dashboard displays correct totals
- Statistics charts render without crash

### Manual QA Checklist
- Widget refreshes within 30 seconds of new post
- Budget alert fires at 80% threshold
- Deep link from notification opens correct post
- Dark mode renders all screens correctly
- Expense parsed from Vietnamese caption (10k, 50K, 100 nghìn, etc.)

---

## 14. Deployment & CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode_15.4.app
      - name: Run Tests
        run: xcodebuild test -scheme SnapLedger -destination 'platform=iOS Simulator,name=iPhone 15'
  deploy_supabase:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
      - run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
```

### Fastlane (`fastlane/Fastfile`)

```ruby
lane :beta do
  increment_build_number
  build_app(scheme: "SnapLedger")
  upload_to_testflight(skip_waiting_for_build_processing: true)
end

lane :release do
  increment_version_number
  build_app(scheme: "SnapLedger")
  upload_to_app_store
end
```

### Environments

| Env | Supabase Project | Purpose |
|---|---|---|
| Development | `snapledger-dev` | Local development + unit tests |
| Staging | `snapledger-staging` | QA + TestFlight beta |
| Production | `snapledger-prod` | App Store release |

---

## Appendix A: Expense Parsing Test Cases

| Caption | Expected Amount | Expected Category |
|---|---|---|
| "Ăn sáng 10k" | 10,000 VND | Food & Drink |
| "Grab về nhà 35K" | 35,000 VND | Transport |
| "Coffee sáng 45,000" | 45,000 VND | Food & Drink |
| "Mua áo 250k" | 250,000 VND | Shopping |
| "Tiền xăng 100 nghìn" | 100,000 VND | Transport |
| "Thuốc 80k" | 80,000 VND | Health |
| "Phim tối qua 75000đ" | 75,000 VND | Entertainment |
| "Ăn trưa với team 150K" | 150,000 VND | Food & Drink |
| "Happy birthday 🎂" | *(no match)* | — |
| "Paid $5 for coffee" | 5 USD | Food & Drink |

---

## Appendix B: Third-Party Dependencies (Swift Package Manager)

```
dependencies:
  - supabase-swift (https://github.com/supabase/supabase-swift) ~> 2.0
  - firebase-ios-sdk (https://github.com/firebase/firebase-ios-sdk) ~> 10.0
    (only Messaging target)
  - swift-composable-architecture (https://github.com/pointfreeco/swift-composable-architecture) ~> 1.0
  - SDWebImageSwiftUI (https://github.com/SDWebImage/SDWebImageSwiftUI) ~> 2.0
  - Sentry (https://github.com/getsentry/sentry-cocoa) ~> 8.0
```

No chart library needed — use native **Swift Charts** (iOS 16+).

---

*Document version: 1.0 | Last updated: June 2026*
