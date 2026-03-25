#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    printf "%b%s%b\n" "$1" "$2" "$NC"
}

info() {
    log "$BLUE" "$1"
}

success() {
    log "$GREEN" "$1"
}

warn() {
    log "$YELLOW" "$1"
}

error() {
    log "$RED" "$1" >&2
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        error "Missing required command: $1"
        exit 1
    fi
}

is_allowed_local_change() {
    case "$1" in
        .env|mosquitto/passwd)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

wait_for_service() {
    local service="$1"
    local timeout="${2:-120}"
    local start_ts
    start_ts="$(date +%s)"

    while true; do
        local container_id
        container_id="$("${compose_base[@]}" ps -q "$service" 2>/dev/null || true)"

        if [ -n "$container_id" ]; then
            local status
            status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

            case "$status" in
                healthy|running)
                    success "$service is $status"
                    return 0
                    ;;
                exited|dead|unhealthy)
                    error "$service entered state: $status"
                    "${compose_base[@]}" logs --tail 40 "$service" || true
                    return 1
                    ;;
            esac
        fi

        if [ $(( $(date +%s) - start_ts )) -ge "$timeout" ]; then
            error "Timed out waiting for $service"
            "${compose_base[@]}" logs --tail 40 "$service" || true
            return 1
        fi

        sleep 2
    done
}

report_service_state() {
    local service="$1"
    local container_id
    container_id="$("${compose_base[@]}" ps -q "$service" 2>/dev/null || true)"

    if [ -z "$container_id" ]; then
        warn "$service is not running in this compose project"
        return 0
    fi

    local status
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

    case "$status" in
        healthy|running)
            success "$service is $status"
            ;;
        *)
            warn "$service is $status"
            "${compose_base[@]}" logs --tail 20 "$service" || true
            ;;
    esac
}

require_command docker
require_command git
require_command curl

if ! docker compose version >/dev/null 2>&1; then
    error "docker compose is required"
    exit 1
fi

if [ -f .env ]; then
    set -a
    . ./.env
    set +a
fi

compose_base=(docker compose)
if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
    compose_base=(docker compose --profile tunnel)
fi

info "Checking for repo updates"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
upstream_ref="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
did_pull="no"

if [ -z "$upstream_ref" ]; then
    warn "No upstream tracking branch configured for $current_branch; skipping git pull"
else
    upstream_remote="${upstream_ref%%/*}"
    git fetch --prune --quiet "$upstream_remote"

    mapfile -t dirty_paths < <(git status --porcelain --untracked-files=no | sed 's/^...//' | sed '/^$/d')
    blocked_paths=()
    conflicting_allowed_paths=()

    for path in "${dirty_paths[@]}"; do
        if is_allowed_local_change "$path"; then
            if git diff --name-only "HEAD..$upstream_ref" -- "$path" | grep -q .; then
                conflicting_allowed_paths+=("$path")
            fi
        else
            blocked_paths+=("$path")
        fi
    done

    if [ "${#blocked_paths[@]}" -gt 0 ]; then
        warn "Skipping git pull because the worktree has local code changes:"
        printf '  - %s\n' "${blocked_paths[@]}"
    elif [ "${#conflicting_allowed_paths[@]}" -gt 0 ]; then
        warn "Skipping git pull because upstream changed locally protected files:"
        printf '  - %s\n' "${conflicting_allowed_paths[@]}"
    else
        if [ "$(git rev-list --count "HEAD..$upstream_ref")" -gt 0 ]; then
            git pull --ff-only --quiet "$upstream_remote" "$current_branch"
            did_pull="yes"
            success "Pulled latest changes from $upstream_ref"
        else
            success "Repo already up to date"
        fi
    fi
fi

services=(timescaledb redis mosquitto backend frontend nginx)
if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
    services+=(cloudflared)
fi

info "Rebuilding and restarting containers"
"${compose_base[@]}" up -d --build --pull always --remove-orphans "${services[@]}"
if [ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
    docker compose --profile tunnel rm -sf cloudflared >/dev/null 2>&1 || true
fi

info "Waiting for core services"
wait_for_service timescaledb 180
wait_for_service redis 120
wait_for_service mosquitto 120
wait_for_service backend 180
wait_for_service frontend 180
wait_for_service nginx 180
if printf '%s\n' "${services[@]}" | grep -qx 'cloudflared'; then
    report_service_state cloudflared
fi

if curl -fsS http://localhost:8080 >/dev/null 2>&1; then
    success "Site is responding on http://localhost:8080"
else
    warn "Nginx container is running, but http://localhost:8080 did not answer yet"
fi

echo
"${compose_base[@]}" ps
echo

if [ "$did_pull" = "yes" ]; then
    success "Containers updated from the latest repo revision"
else
    success "Containers refreshed from the current checkout"
fi
