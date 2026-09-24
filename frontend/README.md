# Goose Man (ห่านบางมด) — Buyer Web App

Mobile-first PWA for KMUTT students to order food that a fellow student carries ("หิ้ว") to their building.
SvelteKit + Svelte 5 runes + Tailwind CSS v4, backed by Supabase. Client-rendered (`ssr = false`).

**Two modes, chosen by env:** with `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` in `.env` the app uses the real
database, Google sign-in and realtime. Without them it runs on in-memory demo data. Setup: [`../supabase/README.md`](../supabase/README.md).

```sh
npm install
npm run dev      # http://localhost:5173
npm run check    # svelte-check / TypeScript
npm run build && npm run preview
```

## Structure

```text
src/
├── routes/+page.svelte      # App shell: startup, screen switcher, bottom nav, sheets, toasts
├── routes/layout.css        # Design tokens (@theme): brand #FA4616, beak, fresh, promptpay
└── lib/
    ├── screens/             # One component per screen (Login, Home, Stores, StoreDetail, CustomOrder,
    │                        #   Checkout, Payment, Tracking, Chat, Success, Orders, Profile, Partner)
    ├── components/          # Shared UI (AppBar, BottomNav, Sheet, Goose walk cycle, RouteStrip, PartnerBadge, …)
    ├── stores/*.svelte.ts   # Rune-based singletons: auth, nav, catalog, cart, checkout, campus, orders, storeView, toast
    ├── api/live.ts          # Every Supabase call + row ↔ type mapping (live mode only)
    ├── supabase.ts          # Client, isLive flag, database error → Thai message
    ├── data/                # Demo catalogue (also generates supabase/seed.sql): stores, locations, riders
    ├── pricing.ts           # Pure pricing rules (fees, promo codes, best promotion, net total)
    └── types/index.ts
```

## Partner stores

- **Buyer perks:** verified badge, listed first, *Fast lane* prep time, storefront banner + tagline.
- **Promotions:** `DEAL` (store's own, live at once) and `CO_PROMO` (joint with Goose Man, shown on Home only after approval).
  One best promotion applies per order (`bestPromotion` in `pricing.ts`, mirrored by `place_order()` in SQL).
- **Partner accounts** open *จัดการร้านของฉัน* to edit the banner, tagline, fast lane and promotions.
  Demo: tap **สำหรับร้านค้า Partner** on the login screen (signs in as ป้าณี's shop; co-promos auto-approve after a few seconds).

## Demo behaviour

- **Sign in**: simulated Google OAuth; only `@kmutt.ac.th` / `@mail.kmutt.ac.th` are accepted (`isKmuttEmail`).
- **Cart**: one store per order — adding from another store clears the cart and shows a toast.
- **Pricing**: `netTotal = max(0, food + fee − promo code − best partner promotion)`. Store fee 15 ฿, custom order fee 20 ฿.
  Promo codes: `KMUTTFIRST` (−15 ฿), `GOOSEFREE` (free delivery).
- **Runner simulation**: accepted after 3 s, delivering after 8 s (`orders.svelte.ts`), with toasts,
  inbox notifications and chat system messages. Use the [เดโม] button on Tracking to simulate OTP entry.
- **PromptPay**: the QR is a visual mock with a 10-minute countdown — not a scannable EMVCo payload.

## Live mode notes

- Orders are created by the `place_order` / `place_custom_order` RPCs; the server total is authoritative.
- Status changes arrive over Supabase Realtime. They are made by the rider-side RPCs
  (`accept_order`, `mark_delivering`, `confirm_delivery`); the rider app itself is not built yet.
- The demo OTP button and the online-rider count are hidden in live mode (there is no real data behind them).
