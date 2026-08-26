---
name: whitenote
description: Post to, list, and read WhiteNote over the network — WhiteNote is the shared communication hub between the human and coding agents. Use to publish a note/status/message ("发帖到 whitenote"), check recent posts, or read a post's replies to see what the human said back to an agent.
---

# WhiteNote

WhiteNote (this project) is reachable over the public internet at
`https://whitenote.goldie-rill.top` via a Cloudflare Tunnel. It doubles as
a communication channel between the human and coding agents: an agent
posts a message into a workspace, the human replies as a comment on it
(or vice versa), and any agent can read that thread back later. There is
no separate API-key mechanism — everything goes through the same
NextAuth credentials login + REST API the web app itself uses, and
messages posted by an agent are indistinguishable from ones posted by the
human — same account, same author identity, no bot flag.

This skill wraps that flow in one script: `whitenote.sh`.

## Prerequisites

- `curl` and `jq` available on PATH.
- Three environment variables set (do **not** hardcode credentials in
  scripts or commit them anywhere):
  - `WHITENOTE_BASE_URL` — e.g. `https://whitenote.goldie-rill.top`
    (defaults to that value if unset)
  - `WHITENOTE_EMAIL` — login email of the WhiteNote account
  - `WHITENOTE_PASSWORD` — login password for that account

These credentials are a full account login (same as the web UI) — whoever
holds them can read/write everything that account can. Keep them in the
calling agent's local secret store / env, never in a repo.

## Commands

```bash
export WHITENOTE_BASE_URL="https://whitenote.goldie-rill.top"
export WHITENOTE_EMAIL="you@example.com"
export WHITENOTE_PASSWORD="your-password"

# See what workspaces exist on this account
./whitenote.sh workspaces

# Post a message (content or content-file; both handle Chinese/emoji fine)
./whitenote.sh post --workspace "默认" --content "Hello from a coding agent" \
  --title "Optional title" --tags "agent,automation"
./whitenote.sh post --workspace "默认" --content-file /tmp/post.txt

# List recent posts, optionally scoped to one workspace
./whitenote.sh list --workspace "默认" --limit 20

# Read one post in full, including every reply/comment on it
./whitenote.sh read <message-id>
```

- `post --workspace` accepts a workspace **name** or **id**. `--content`
  or `--content-file` is required; `--title`/`--tags` optional
  (`--tags` is comma-separated tag names). Media upload isn't supported
  by this script — use the web UI for that.
- `list --workspace` is optional (omit to use the account's default
  workspace, same as the API's own default); `--limit` defaults to 20.
  Prints each message's id, timestamp, author, workspace, reply count,
  and a content preview — get a message's id from here to feed into `read`.
- `read <message-id>` prints the full message plus every comment/reply on
  it (flat, chronological; a reply-to-a-reply is prefixed with `↳`). This
  is how an agent checks whether the human responded to something it
  posted.

On success, `post`/`read` print JSON or formatted text to stdout; `list`
and `workspaces` print human-readable lines. On failure, all commands
exit non-zero with a message on stderr — most commonly: wrong credentials
(401 at `/api/auth/me`), or a workspace/message id not found for that
account.

## How it works

Every command starts with the same login handshake:

1. `GET /api/auth/csrf` — fetch a CSRF token + cookie (NextAuth v5
   requires this before a credentials login).
2. `POST /api/auth/callback/credentials` — log in with email/password,
   reusing the CSRF cookie. NextAuth sets a session cookie in the same
   cookie jar.
3. `GET /api/auth/me` — sanity-check the session actually authenticated.

Then, per command:

- `workspaces` → `GET /api/workspaces`.
- `post` → resolve `--workspace` against `GET /api/workspaces`, then
  `POST /api/messages` with `{ content, title?, tags?, workspaceId }`.
- `list` → optionally resolve `--workspace`, then
  `GET /api/messages?limit=N[&workspaceId=...]`.
- `read` → `GET /api/messages/:id`, which returns the message together
  with its full comment list in one response.

All requests go through the public Cloudflare Tunnel URL, so this works
from any machine with internet access — no Tailscale/VPN needed.

Request bodies are always written to a temp file and sent with `curl
--data-binary @file`, never `curl -d "$string"`: the curl build on
Windows (mingw-w64 native) silently mangles non-ASCII bytes passed as a
command-line argument (confirmed with `--trace-ascii` — corrupted bytes
already on the wire before the request left the machine). `jq` is
unaffected, so it's safe to use for building the file contents.

## Using this skill from another machine/agent

This file only auto-loads for Claude Code sessions that have it under
`.claude/skills/` (project-scoped, so only sessions working in a checkout
of this repo) or under `~/.claude/skills/` (user-scoped, any project on
that machine). To let an agent on a different machine or a non-Claude-Code
tool use it, copy this directory (`SKILL.md` + `whitenote.sh`) to that
machine — the script itself has no dependency on this repo, only on
`curl`/`jq` and the three env vars above.
