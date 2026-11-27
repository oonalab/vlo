#!/usr/bin/env bash
# Fails unless the given title is a Conventional Commit: `type(scope)!: summary`.
#
#   feat: …      a new capability        → minor bump (patch while below 1.0)
#   fix: …       a bug fix               → patch bump
#   feat!: …     a breaking change       → major bump (minor while below 1.0)
#   everything else is recorded but does not release on its own.
set -euo pipefail

TITLE="${1:-}"
TYPES="feat|fix|perf|revert|docs|refactor|test|build|ci|chore"
PATTERN="^(${TYPES})(\([a-z0-9][a-z0-9._/-]*\))?!?: [^ ].*$"

if [[ "$TITLE" =~ $PATTERN ]]; then
  echo "ok   $TITLE"
  exit 0
fi

cat >&2 <<MSG
FAIL "$TITLE" is not a Conventional Commit title.

Expected:  type(optional-scope): summary
Types:     ${TYPES//|/, }
Examples:  feat(agent): park on an exhausted budget
           fix: resolve the vlo bin through its symlink
           feat!: rename the host entry point
MSG
exit 1
