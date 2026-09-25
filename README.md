# Goose Man (ห่านบางมด)

Campus peer-to-peer food delivery for KMUTT Bang Mod: students order from campus stores and a fellow student
carries ("หิ้ว") the food to their building. KMUTT accounts only (`@kmutt.ac.th` / `@mail.kmutt.ac.th`).

| Folder | What it is |
|---|---|
| [`frontend/`](frontend/README.md) | The app (buyers, partner stores, riders): SvelteKit + Svelte 5 + Tailwind CSS v4. Runs on demo data until Supabase keys are set |
| [`supabase/`](supabase/README.md) | Backend: schema, Row-Level Security, order RPCs, seed data, setup guide (Thai) |
| `bench/routing/` | Route planner benchmark and OR-Tools comparison |
| [`backend/`](backend/README.md) | Superseded Go/Fiber backend, kept for reference (as is `docker-compose.yml`) |

```sh
cd frontend && npm install && npm run dev   # http://localhost:5173
```

**Team guide (Thai, start here):** [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md): how everything works, how to run, test and deploy.
**Plan (Thai):** [`PLAN.md`](PLAN.md): what has been done, recent updates, and what comes next.
