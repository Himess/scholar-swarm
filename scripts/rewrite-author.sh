#!/bin/bash
# One-shot history rewrite for Scholar Swarm:
#   - Replaces every "scholar-swarm@local" author/committer with the real identity
#   - Re-signs every commit with GPG
# Run from repo root. Pre-run: ensure backup tag exists. Post-run: force-push.

set -euo pipefail

if [ ! -d ".git" ]; then
    echo "must run from repo root" >&2
    exit 1
fi

if ! git rev-parse pre-rewrite-backup >/dev/null 2>&1; then
    echo "creating pre-rewrite-backup tag at current HEAD"
    git tag pre-rewrite-backup
fi

echo "Rewriting authors + re-signing commits on master…"

git filter-branch -f \
    --env-filter '
if [ "$GIT_AUTHOR_EMAIL" = "scholar-swarm@local" ]; then
    export GIT_AUTHOR_EMAIL="semihcvlk53@gmail.com"
    export GIT_AUTHOR_NAME="Himess"
fi
if [ "$GIT_COMMITTER_EMAIL" = "scholar-swarm@local" ]; then
    export GIT_COMMITTER_EMAIL="semihcvlk53@gmail.com"
    export GIT_COMMITTER_NAME="Himess"
fi
' \
    --commit-filter '
git commit-tree -S "$@"
' \
    --tag-name-filter cat \
    -- master

echo
echo "Done. Verify with: git log --pretty=fuller -3"
