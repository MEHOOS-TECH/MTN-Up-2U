# DataResell Pro

A Ghana data reseller platform — storefront, reseller dashboard, admin panel.

## Project Structure

```
dataresell-pro/
├── index.html      ← HTML shell (loads CSS + JS)
├── style.css       ← All styles
├── app.js          ← All React components (JSX)
├── vercel.json     ← Vercel routing config (SPA + /store/:slug)
└── README.md
```

## How to Deploy (no laptop needed)

### Step 1 — Push to GitHub (from phone/tablet)

1. Go to [github.com](https://github.com) → Sign in (or create a free account)
2. Click **+** → **New repository**
3. Name it `dataresell-pro`, set to **Public**, click **Create repository**
4. On the repo page, click **Add file → Upload files**
5. Upload all 4 files: `index.html`, `style.css`, `app.js`, `vercel.json`
6. Click **Commit changes**

### Step 2 — Deploy on Vercel (free)

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **Add New → Project**
3. Select your `dataresell-pro` repo → Click **Import**
4. Leave all settings as default (it auto-detects as a static site)
5. Click **Deploy**

Your site goes live at `https://dataresell-pro.vercel.app` (or your custom domain).

### Step 3 — Custom Domain (optional)

In Vercel → Project → Settings → Domains → Add your domain.

## Notes

- The `/store/:slug` route works via the `vercel.json` rewrite rule
- Supabase and Paystack keys are already embedded in `app.js`
- To update the site: edit files on GitHub → Vercel auto-redeploys
