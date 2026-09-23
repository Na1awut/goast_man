# Goose Man (ห่านบางมด) — Buyer Web App 🪿

Mobile-first PWA for KMUTT students to order food that a fellow student carries ("หิ้ว") to their building.
SvelteKit + Svelte 5 runes + Tailwind CSS v4. Client-rendered (`ssr = false`), mock data in memory.

```sh
npm install
npm run dev      # http://localhost:5173
npm run check    # svelte-check / TypeScript
npm run build && npm run preview
```

## Structure

```text
src/
├── routes/+page.svelte      # App shell: header, screen switcher, bottom nav, sheets, toasts
├── routes/layout.css        # Design tokens (@theme): brand #FA4616, beak, fresh, promptpay
└── lib/
    ├── screens/             # One component per screen (Login, Home, Stores, StoreDetail,
    │                        #   CustomOrder, Checkout, Tracking, Chat, Success, Orders, Profile)
    ├── components/          # Shared UI (TopHeader, BottomNav, Sheet, PromptPayModal, …)
    ├── stores/*.svelte.ts   # Rune-based singletons: auth, nav, cart, campus, orders, storeView, toast
    ├── data/                # Mock catalogue: stores, locations, riders (mirrors backend seeder)
    ├── pricing.ts           # Pure pricing rules (fees, promo codes, partner deals, net total)
    └── types/index.ts
```

## Demo behaviour

- **Sign in**: simulated Google OAuth; only `@kmutt.ac.th` / `@mail.kmutt.ac.th` are accepted (`isKmuttEmail`).
- **Cart**: one store per order — adding from another store clears the cart and shows a toast.
- **Pricing**: `netTotal = max(0, food + fee − promo − partner deal)`. Store fee 15 ฿, custom order fee 20 ฿.
  Promo codes: `KMUTTFIRST` (−15 ฿), `GOOSEFREE` (free delivery).
- **Runner simulation**: accepted after 3 s, delivering after 8 s (`orders.svelte.ts`), with toasts,
  inbox notifications and chat system messages. Use the 🧪 button on Tracking to simulate OTP entry.
- **PromptPay**: the QR is a visual mock with a 10-minute countdown — not a scannable EMVCo payload.

## Connecting the backend

The order lifecycle mirrors the Go backend state machine (`PENDING → ACCEPTED → DELIVERING → COMPLETED`).
To go live, replace `auth.signInWithGoogle` with `/api/v1/auth/google`, `orders.place` with a POST to
`/api/v1/orders`, and the `#simulateRunner` timers with `ORDER_*` events from `ws://…/api/v1/ws`.
