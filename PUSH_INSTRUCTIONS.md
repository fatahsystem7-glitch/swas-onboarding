# How to push this repo to GitHub

The project is complete and already committed to git inside the workspace
(1 commit, `node_modules` excluded via `.gitignore`). Pick **one** of the two
options below to get it onto GitHub from your own authenticated machine.

---

## Option A — Use the git bundle (preserves commit history) ✅ recommended

A single-file copy of the repo (with history) is at the workspace root:
**`swas-onboarding.bundle`**

1. **Download** `swas-onboarding.bundle` from the workspace to your computer.

2. **Create an empty repo** on GitHub (no README/gitignore/license), e.g.
   `swas-onboarding`. Copy its remote URL.

3. In a terminal on your machine:

   ```bash
   # Clone the bundle into a new working copy
   git clone swas-onboarding.bundle swas-onboarding
   cd swas-onboarding

   # Point at your new GitHub repo
   git remote remove origin
   git remote add origin https://github.com/<you>/swas-onboarding.git

   # Push (rename branch to main if you prefer)
   git branch -M main
   git push -u origin main
   ```

---

## Option B — Push straight from the downloaded folder

If you download the whole `swas-onboarding/` folder instead of the bundle:

```bash
cd swas-onboarding

# If the .git folder came with it, skip init; otherwise:
git init
git add -A
git commit -m "feat: SwaS automated onboarding & telephony engine"

git branch -M main
git remote add origin https://github.com/<you>/swas-onboarding.git
git push -u origin main
```

> Tip: authenticate either with the GitHub CLI (`gh auth login`) or a Personal
> Access Token used as the password when git prompts you.

---

## After pushing

- Set the environment variables from `.env.example` in Railway's **Variables** tab.
- Add the Railway **PostgreSQL** plugin (it injects `DATABASE_URL`).
- Deploy — `railway.json` runs `npm run migrate && npm start`.
- Point your Telnyx webhook at
  `https://<your-service>.up.railway.app/api/webhooks/telnyx`.
