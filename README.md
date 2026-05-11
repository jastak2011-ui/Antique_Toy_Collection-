# Antique Toy Ledger

A small shared inventory app for antique toys and finds.

Items can include a compressed photo. On mobile and tablet browsers, the `Add Image` button opens the device's native camera/photo-library picker. Photos are stored with the item data in `data/items.json`, so they sync through the same GitHub save path when GitHub sync is enabled.

## Local Use

```powershell
node server.js
```

Open:

```text
http://127.0.0.1:4173
```

Local saves are written to:

```text
data/items.json
```

## Shared GitHub-Backed Use

To share a public link where other people can add items and have every save committed to your GitHub repo, run this app on a Node host such as Render, Railway, Fly.io, or another service that supports environment variables.

Do not put your GitHub token in `app.js`, `index.html`, or any browser code. The token must only live on the server as an environment variable.

Set these environment variables on your hosting service:

```text
GITHUB_OWNER=your-github-username-or-org
GITHUB_REPO=your-repo-name
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data/items.json
GITHUB_TOKEN=your-fine-grained-token
GITHUB_COMMITTER_NAME=Antique Toy Ledger
GITHUB_COMMITTER_EMAIL=you@example.com
HOST=0.0.0.0
PORT=4173
```

The GitHub token needs write access to repository contents for the repo that stores this app. A fine-grained personal access token scoped to this one repository is best.

When GitHub sync is configured, every add, edit, or delete updates `data/items.json` and creates a commit in your repository. The app header will show `Saved to GitHub` when the commit succeeds.

## Important Sharing Note

GitHub Pages alone cannot safely do this because it only serves static files and cannot keep your token secret. You need a server or serverless function between the public form and GitHub.
