# Alliance Polysacks — RP Plant Reporting App
### Stack: Supabase (free) + Netlify (free) + PWABuilder (free) — no card anywhere

This is a single website (a PWA — Progressive Web App). The **same URL**:
- works normally in any desktop/laptop browser (this IS your "desktop portal" —
  no separate site needed),
- and gets wrapped by PWABuilder into a real installable Android `.apk`.

No native app project, no Expo, no build servers to manage.

## Why this is genuinely free
- **Supabase** free tier: Postgres database + row-level security, no card to sign up.
  All the "backend logic" (passcode check, rate lookup, settings update) runs as
  Postgres functions — there's no separate server to host or pay for.
- **Netlify** free "Starter" tier hosts the site (and rebuilds it) — no card needed.
- **PWABuilder** (pwabuilder.com, made by Microsoft) is a free tool that packages
  any PWA into an Android app — no Play Store account required to just install
  the APK directly on your own phone.
- **PDF** is generated entirely in the browser with `jspdf` — no backend call,
  no storage bucket, works even if Netlify is slow or the function cold-starts
  (there are no functions).

## One honest trade-off
The Admin Report PDF is not password-locked **as a file** — same situation as
discussed before. True in-file PDF encryption needs a native binary (`qpdf`)
that browsers can't run. The real protection is the passcode gate before the
data (and PDF) are ever shown — nobody without the passcode ever sees it.

---

## Setup — do these once, in order

### 1. Supabase — create the tables and the "backend" functions
- You already have a project: `https://pqnbuyednsfuikuklavd.supabase.co` (built in).
- Go to your Supabase Dashboard → **SQL Editor** → New query.
- Paste the entire contents of `supabase/schema.sql` from this folder → **Run**.
- That's it — this one script creates the tables, locks down `admin_settings`
  with Row Level Security, and creates the three functions
  (`verify_admin_passcode`, `get_admin_rates`, `update_admin_settings`) that
  do the passcode-gated logic. It also sets your starting passcode to `232003`
  and the rates you gave (Old: 2.10 / 4025, New: 2.75 / 3760).

### 2. Push this folder to GitHub
```bash
cd rp-plant-pwa
git init
git add .
git commit -m "RP Plant reporting PWA"
# create an empty repo on github.com, then:
git remote add origin <your-repo-url>
git push -u origin main
```

### 3. Deploy to Netlify (free, no card)
- https://app.netlify.com → **Add new site → Import an existing project**
  → connect GitHub → pick this repo.
- Build command: `npm run build`  ·  Publish directory: `dist`
  (already set in `netlify.toml`, Netlify should detect it automatically).
- Deploy. You'll get a real URL like `https://yoursite.netlify.app` — open it,
  the app works right there in the browser already (this is also your
  "desktop" link — nothing else to set up for that).

> Prefer not to use GitHub? `npm run build` locally, then drag the `dist/`
> folder onto https://app.netlify.com/drop — also free, gives you a URL
> immediately, just doesn't auto-redeploy on future changes.

### 4. Turn it into an installable Android app with PWABuilder
- Go to https://www.pwabuilder.com
- Paste your Netlify URL (`https://yoursite.netlify.app`) → **Start**.
- It scans the site (manifest + service worker are already set up in this
  project) → go to the **Android** package tab → **Generate Package**.
- Download the generated `.apk` (choose the "Signing key: generate new" option
  if asked — fine for personal/internal installs).
- Transfer the `.apk` to your phone (email it to yourself, or use a USB
  cable/Google Drive) and open it → Android will ask to allow "install from
  unknown sources" once → Install.

You now have a real icon on your phone's home screen, working fully offline
for navigation (data still needs internet to save/load, same as WhatsApp).

**Even simpler alternative to steps 4:** on the phone, open the Netlify URL in
Chrome → tap the menu (⋮) → **"Add to Home screen" / "Install app"**. This
installs the PWA directly, no APK file needed at all, still a real app icon.
Use PWABuilder's APK only if you specifically want a shareable `.apk` file to
send to other operators' phones without them visiting the URL first.

---

## Local testing before deploying
```bash
npm install
npm run dev
```
Open the printed `localhost` URL — it already talks to your real Supabase
project, so you can test Copy, entries, and PDF download right on your
computer first.

## Quick sanity checks
- **"Incorrect passcode" even with 232003** → the SQL script (step 1) wasn't
  run yet, or was run against a different Supabase project.
- **Copy button missing** → that's by design when there's no data yet (all
  zeros) — enter at least one non-zero value.
- **PDF doesn't download** → check the browser isn't blocking pop-ups/downloads
  for that site; `jspdf`'s `.save()` triggers a normal browser download.
- **Changes on phone don't show on another phone** → make sure both are
  pointed at the same Netlify URL — Supabase data is shared across all of
  them automatically, it's the same database either way.
