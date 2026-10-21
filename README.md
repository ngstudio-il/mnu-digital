# mnu.digital

Digital QR menus for restaurants, cafés, bars and hotels: a marketing site, sign-up (Google or email), a dashboard to manage the menu and orders, and the public menu guests open from a QR code.

## Stack

- **Next.js 15** (App Router), deployed on **Vercel**
- **Supabase**: Postgres database, auth (Google + email), storage for dish photos, realtime order updates

## Pages

| Path | What it is |
| --- | --- |
| `/` | Marketing site |
| `/signup`, `/login` | Account creation and sign-in (Google or email) |
| `/onboarding` | First-time venue setup |
| `/dashboard` | Overview: today’s orders, revenue, best sellers, setup checklist |
| `/dashboard/orders` | Live order board (New → Preparing → Ready → Completed) |
| `/dashboard/menu` | Categories, dishes, prices, photos, availability |
| `/dashboard/qr` | Menu QR code and one per table (downloadable) |
| `/dashboard/settings` | Venue details, ordering options, brand colour, languages |
| `/m/<venue-slug>` | Public guest menu with ordering (`?t=5` pre-fills table 5) |

## One-time setup

### 1. Supabase
1. Create a project at supabase.com (pick an EU region).
2. **SQL Editor** → paste the contents of `supabase/migrations/0001_init.sql` → **Run**.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

### 2. Google sign-in
1. In Google Cloud Console create an OAuth client (type *Web application*).
2. Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
3. In Supabase → **Authentication → Providers → Google**: enable it and paste the client ID and secret.
4. In Supabase → **Authentication → URL Configuration**: set *Site URL* to your live domain and add `https://<your-domain>/auth/callback` to *Redirect URLs*.

### 3. Vercel
1. Import this GitHub repo in Vercel.
2. Add environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. Every push to `main` redeploys automatically.

## Local development

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
```
