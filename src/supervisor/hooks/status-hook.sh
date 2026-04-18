#!/bin/bash
# Claude Code hook: 写入状态到 .themis/status.json
# Usage: Configure in Claude Code's settings.json or as a global hook
#
# Environment variables set by Claude Code:
#   CLAUDE_TASK_ID     - Task identifier
#   CLAUDE_HOOK_TYPE   - Hook type (PostToolUse, SessionEnd, etc.)
#   CLAUDE_TOOL_NAME   - Tool that was just used (PostToolUse only)
#   CLAUDE_DIR         - Task working directory

set -e

TASK_DIR="${CLAUDE_DIR:-.}"
STATUS_FILE="$TASK_DIR/.themis/status.json"
TASK_ID="${CLAUDE_TASK_ID:-unknown}"

# Ensure .themis directory exists
mkdir -p "$TASK_DIR/.themis"

# Initialize status file if it doesn't exist
init_status() {
    if [ ! -f "$STATUS_FILE" ]; then
        cat > "$STATUS_FILE" << EOF
{
  "task_id": "$TASK_ID",
  "phase": "initialized",
  "step": "initial",
  "last_activity": "$(date -Iseconds)",
  "last_tool": "",
  "progress_percent": 0,
  "messages_count": 0,
  "errors": [],
  "spec_checkpoints": {},
  "needs_review": false,
  "review_reason": null
}
EOF
    fi
}

# Update a single field in status JSON using sed (jq-independent fallback)
update_field() {
    local field="$1"
    local value="$2"

    if [ ! -f "$STATUS_FILE" ]; then
        init_status
    fi

    # Use jq if available for proper JSON handling
    if command -v jq >/dev/null 2>&1; then
        local tmp=$(mktemp)
        jq --arg field "$field" --arg value "$value" \
           --arg now "$(date -Iseconds)" \
           '.last_activity = $now | .[$field] = $value' \
           "$STATUS_FILE" > "$tmp" && mv "$tmp" "$STATUS_FILE"
    else
        # Fallback: basic sed replacement for simple fields
        case "$field" in
            phase|step|last_tool|review_reason)
                sed -i '' "s/\"$field\": \"[^\"]*\"/\"$field\": \"$value\"/" "$STATUS_FILE" 2>/dev/null || true
                ;;
            progress_percent|messages_count)
                sed -i '' "s/\"$field\": [0-9]*/\"$field\": $value/" "$STATUS_FILE" 2>/dev/null || true
                ;;
            needs_review)
                sed -i '' "s/\"needs_review\": \(true\|false\)/\"needs_review\": $value/" "$STATUS_FILE" 2>/dev/null || true
                ;;
        esac
        # Always update last_activity
        sed -i '' "s/\"last_activity\": \"[^\"]*\"/\"last_activity\": \"$(date -Iseconds)\"/" "$STATUS_FILE" 2>/dev/null || true
    fi
}

# Append an error
append_error() {
    local error_msg="$1"

    if [ ! -f "$STATUS_FILE" ]; then
        init_status
    fi

    if command -v jq >/dev/null 2>&1; then
        local tmp=$(mktemp)
        jq --arg error "$error_msg" \
           --arg now "$(date -Iseconds)" \
           '.last_activity = $now | .errors += [$error]' \
           "$STATUS_FILE" > "$tmp" && mv "$tmp" "$STATUS_FILE"
    fi
}

# Mark a checkpoint as reached
mark_checkpoint() {
    local checkpoint="$1"

    if [ ! -f "$STATUS_FILE" ]; then
        init_status
    fi

    if command -v jq >/dev/null 2>&1; then
        local tmp=$(mktemp)
        jq --arg checkpoint "$checkpoint" \
           --arg now "$(date -Iseconds)" \
           '.last_activity = $now | .spec_checkpoints[$checkpoint] = true' \
           "$STATUS_FILE" > "$tmp" && mv "$tmp" "$STATUS_FILE"
    fi
}

# Set needs_review flag
set_needs_review() {
    local reason="$1"

    if [ ! -f "$STATUS_FILE" ]; then
        init_status
    fi

    if command -v jq >/dev/null 2>&1; then
        local tmp=$(mktemp)
        jq --arg reason "$reason" \
           --arg now "$(date -Iseconds)" \
           '.last_activity = $now | .needs_review = true | .review_reason = $reason' \
           "$STATUS_FILE" > "$tmp" && mv "$tmp" "$STATUS_FILE"
    fi
}

# Main hook handling
main() {
    local hook_type="${CLAUDE_HOOK_TYPE:-}"

    case "$hook_type" in
        PostToolUse)
            # Record tool usage
            if [ -n "${CLAUDE_TOOL_NAME:-}" ]; then
                update_field "last_tool" "$CLAUDE_TOOL_NAME"
            fi
            ;;
        SessionEnd)
            # Mark session ended, needs review
            set_needs_review "session_ended"
            ;;
        SessionStart)
            # Session started
            update_field "phase" "running"
            ;;
        *)
            # Default: just update activity timestamp
            update_field "last_tool" "${hook_type:-unknown}"
            ;;
    esac
}

# Run main
main "$@"
