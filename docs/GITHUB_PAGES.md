# GitHub Pages (static site)

The `docs/` folder is a **small static marketing site** (not the full Next.js app). It deploys to GitHub Pages.

## One-time setup in GitHub

1. Open the repository on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions** (not “Deploy from a branch”).
3. Push to `main` or `master`, or run the **Deploy GitHub Pages** workflow manually (**Actions** → workflow → **Run workflow**).

After the first successful run, your site URL will be:

- **Project repository:** `https://<owner>.github.io/<repo>/`  
  Example: `https://acme.github.io/SentinelForge/`
- **User or organization site** (only if this repo is named `<username>.github.io`):  
  `https://<username>.github.io/`

## Optional: pin the repository URL

If the automatic link guess is wrong, set the meta tag in `docs/index.html`:

```html
<meta name="github-repo" content="https://github.com/OWNER/REPO" />
```

## Full product

The real application (dashboard, API, database, WebSockets) is **not** hosted here. Self-host with Docker; see the root [README](../README.md).
