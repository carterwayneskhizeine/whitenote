#!/usr/bin/env bash
# Talk to WhiteNote over the network: post messages, list recent posts,
# and read a post's replies. See SKILL.md in this directory for full docs.
set -euo pipefail

SELF="$(basename "$0")"

usage() {
  cat >&2 <<EOF
Usage:
  $SELF post --workspace <name-or-id> (--content "text" | --content-file path) [--title "title"] [--tags tag1,tag2]
  $SELF list [--workspace <name-or-id>] [--limit N]
  $SELF read <message-id>
  $SELF workspaces

Required env vars:
  WHITENOTE_EMAIL
  WHITENOTE_PASSWORD

Optional env var:
  WHITENOTE_BASE_URL   (default: https://whitenote.goldie-rill.top)
EOF
}

COMMAND="${1:-}"
[[ -n "$COMMAND" ]] || { usage; exit 1; }
shift || true

case "$COMMAND" in
  post|list|read|workspaces) ;;
  -h|--help) usage; exit 0 ;;
  *) echo "Error: unknown command: $COMMAND" >&2; usage; exit 1 ;;
esac

: "${WHITENOTE_EMAIL:?Missing WHITENOTE_EMAIL env var}"
: "${WHITENOTE_PASSWORD:?Missing WHITENOTE_PASSWORD env var}"
BASE_URL="${WHITENOTE_BASE_URL:-https://whitenote.goldie-rill.top}"
BASE_URL="${BASE_URL%/}"

command -v curl >/dev/null 2>&1 || { echo "Error: curl is required" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required" >&2; exit 1; }

JAR="$(mktemp)"
RESPONSE_FILE="$(mktemp)"
LOGIN_BODY_FILE="$(mktemp)"
BODY_FILE="$(mktemp)"
trap 'rm -f "$JAR" "$RESPONSE_FILE" "$LOGIN_BODY_FILE" "$BODY_FILE"' EXIT

# NOTE ON ENCODING: request bodies are always written to a temp file and sent
# with `curl --data-binary @file`, never `curl -d "$string"`. The curl build
# on Windows (mingw-w64 native, e.g. `curl 8.21.0 x86_64-w64-mingw32`) silently
# mangles non-ASCII bytes passed as a command-line argument (confirmed with
# --trace-ascii: corrupted bytes already on the wire before the request left
# the machine). Reading the body from a file avoids that entirely. `jq` is
# unaffected -- its --arg/--argjson values round-trip UTF-8 correctly -- so
# it's safe to use for building the file contents.

login() {
  local csrf_response csrf_token me_status
  csrf_response=$(curl -sS -c "$JAR" "$BASE_URL/api/auth/csrf")
  csrf_token=$(echo "$csrf_response" | jq -r '.csrfToken // empty')
  if [[ -z "$csrf_token" ]]; then
    echo "Error: failed to fetch CSRF token from $BASE_URL" >&2
    echo "$csrf_response" >&2
    exit 1
  fi

  printf 'csrfToken=%s&email=%s&password=%s&json=true' \
    "$(jq -rn --arg v "$csrf_token" '$v|@uri')" \
    "$(jq -rn --arg v "$WHITENOTE_EMAIL" '$v|@uri')" \
    "$(jq -rn --arg v "$WHITENOTE_PASSWORD" '$v|@uri')" > "$LOGIN_BODY_FILE"
  curl -sS -o /dev/null -b "$JAR" -c "$JAR" \
    -X POST "$BASE_URL/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-binary @"$LOGIN_BODY_FILE"

  me_status=$(curl -sS -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE_URL/api/auth/me")
  if [[ "$me_status" != "200" ]]; then
    echo "Error: login failed (GET /api/auth/me returned $me_status)." >&2
    echo "Check WHITENOTE_EMAIL / WHITENOTE_PASSWORD." >&2
    exit 1
  fi
}

fetch_workspaces_json() {
  curl -sS -b "$JAR" "$BASE_URL/api/workspaces"
}

# Resolves a workspace name-or-id to an id, given the JSON from fetch_workspaces_json.
# Prints the id on stdout, or nothing (and a stderr message) if not found.
resolve_workspace_id() {
  local workspaces_json="$1" workspace="$2"
  echo "$workspaces_json" | jq -r --arg w "$workspace" \
    '[.data[]? | select(.id == $w or .name == $w)] | first | .id // empty'
}

print_available_workspaces() {
  local workspaces_json="$1"
  echo "Available workspaces for this account:" >&2
  echo "$workspaces_json" | jq -r '.data[]? | "  - \(.name) (\(.id))"' >&2
}

cmd_post() {
  local workspace="" content="" content_file="" title="" tags=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --workspace) workspace="${2:-}"; shift 2 ;;
      --content) content="${2:-}"; shift 2 ;;
      --content-file) content_file="${2:-}"; shift 2 ;;
      --title) title="${2:-}"; shift 2 ;;
      --tags) tags="${2:-}"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
    esac
  done

  [[ -n "$workspace" ]] || { echo "Error: --workspace is required" >&2; usage; exit 1; }
  if [[ -n "$content_file" ]]; then
    [[ -f "$content_file" ]] || { echo "Error: --content-file not found: $content_file" >&2; exit 1; }
    content="$(cat "$content_file")"
  fi
  [[ -n "$content" ]] || { echo "Error: --content or --content-file is required" >&2; usage; exit 1; }

  login
  local workspaces_json workspace_id
  workspaces_json=$(fetch_workspaces_json)
  workspace_id=$(resolve_workspace_id "$workspaces_json" "$workspace")
  if [[ -z "$workspace_id" ]]; then
    echo "Error: workspace not found: $workspace" >&2
    print_available_workspaces "$workspaces_json"
    exit 1
  fi

  local tags_json
  if [[ -n "$tags" ]]; then
    tags_json=$(echo "$tags" | tr ',' '\n' | sed '/^$/d' | jq -R . | jq -s .)
  else
    tags_json="[]"
  fi

  jq -n \
    --arg content "$content" \
    --arg title "$title" \
    --arg workspaceId "$workspace_id" \
    --argjson tags "$tags_json" \
    '{content: $content, workspaceId: $workspaceId, tags: $tags}
     + (if $title != "" then {title: $title} else {} end)' > "$BODY_FILE"

  local http_code
  http_code=$(curl -sS -b "$JAR" -o "$RESPONSE_FILE" -w '%{http_code}' \
    -X POST "$BASE_URL/api/messages" \
    -H "Content-Type: application/json" \
    --data-binary @"$BODY_FILE")

  if [[ "$http_code" != "201" ]]; then
    echo "Error: failed to create message (HTTP $http_code)" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi
  jq . "$RESPONSE_FILE"
}

cmd_list() {
  local workspace="" limit="20"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --workspace) workspace="${2:-}"; shift 2 ;;
      --limit) limit="${2:-}"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
    esac
  done

  login
  local workspaces_json workspace_id="" query="limit=$limit"
  workspaces_json=$(fetch_workspaces_json)
  if [[ -n "$workspace" ]]; then
    workspace_id=$(resolve_workspace_id "$workspaces_json" "$workspace")
    if [[ -z "$workspace_id" ]]; then
      echo "Error: workspace not found: $workspace" >&2
      print_available_workspaces "$workspaces_json"
      exit 1
    fi
    query="$query&workspaceId=$workspace_id"
  fi

  local http_code
  http_code=$(curl -sS -b "$JAR" -o "$RESPONSE_FILE" -w '%{http_code}' \
    "$BASE_URL/api/messages?$query")
  if [[ "$http_code" != "200" ]]; then
    echo "Error: failed to list messages (HTTP $http_code)" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi

  jq -r --argjson ws "$workspaces_json" '
    ($ws.data // []) as $workspaces
    | .data[]?
    | . as $m
    | ($workspaces | map(select(.id == $m.workspaceId)) | .[0].name // $m.workspaceId // "?") as $wsName
    | "[\(.id)] \(.createdAt) by \(.author.name // "?") in \($wsName) (\(._count.comments) replies)\n  \(.content // "" | gsub("\n"; " ") | if length > 160 then .[0:160] + "…" else . end)\n"
  ' "$RESPONSE_FILE"
}

cmd_read() {
  local message_id="${1:-}"
  [[ -n "$message_id" ]] || { echo "Error: message id is required" >&2; usage; exit 1; }

  login
  local http_code
  http_code=$(curl -sS -b "$JAR" -o "$RESPONSE_FILE" -w '%{http_code}' \
    "$BASE_URL/api/messages/$message_id")
  if [[ "$http_code" != "200" ]]; then
    echo "Error: failed to fetch message (HTTP $http_code)" >&2
    cat "$RESPONSE_FILE" >&2
    exit 1
  fi

  jq -r '
    .data as $m
    | "=== \($m.title // "(no title)") ===",
      "by \($m.author.name // "?") at \($m.createdAt)",
      "",
      ($m.content // ""),
      "",
      "--- \($m.comments | length) repl" + (if ($m.comments | length) == 1 then "y" else "ies" end) + " ---",
      (
        $m.comments[]?
        | (if .parentId then "  ↳ " else "" end)
          + "[\(.id)] \(.author.name // "?") @ \(.createdAt): \(.content // "" | gsub("\n"; " "))"
      )
  ' "$RESPONSE_FILE"
}

cmd_workspaces() {
  login
  local workspaces_json
  workspaces_json=$(fetch_workspaces_json)
  echo "$workspaces_json" | jq -r '.data[]? | "\(.name) (\(.id))" + (if .isDefault then " [default]" else "" end)'
}

case "$COMMAND" in
  post) cmd_post "$@" ;;
  list) cmd_list "$@" ;;
  read) cmd_read "$@" ;;
  workspaces) cmd_workspaces "$@" ;;
esac
