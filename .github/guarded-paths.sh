#!/usr/bin/env bash
# Reads changed paths on stdin, one per line, and prints `guarded=true` if any
# of them is listed in the CODEOWNERS file given as the first argument, else
# `guarded=false`. Run by .github/workflows/guardrail-approval.yml.
#
# Only a subset of the CODEOWNERS format is read, and anything else fails the
# run instead of being skipped: a pattern this script misread would leave a
# path unguarded. Each rule is `/path owner…`: a leading slash, a trailing
# slash for a folder (every path under it), otherwise one exact file. No
# wildcards, no negations, no line without an owner.
set -euo pipefail

codeowners="${1:?usage: guarded-paths.sh CODEOWNERS < changed-paths}"
folders=()
files=()
while read -r pattern owner _; do
  case "$pattern" in '' | '#'*) continue ;; esac
  if [ -z "${owner:-}" ]; then
    echo "::error::CODEOWNERS: no owner for $pattern" >&2
    exit 1
  fi
  if [[ "$pattern" != /* || "$pattern" == *[*?![]* ]]; then
    echo "::error::CODEOWNERS: unsupported pattern $pattern" >&2
    exit 1
  fi
  pattern="${pattern#/}"
  if [[ "$pattern" == */ ]]; then folders+=("$pattern"); else files+=("$pattern"); fi
done < "$codeowners"

if [ $((${#folders[@]} + ${#files[@]})) -eq 0 ]; then
  echo "::error::CODEOWNERS lists no paths" >&2
  exit 1
fi

guarded=false
while IFS= read -r path; do
  [ -n "$path" ] || continue
  for folder in ${folders[@]+"${folders[@]}"}; do
    if [[ "$path" == "$folder"* ]]; then guarded=true; fi
  done
  for file in ${files[@]+"${files[@]}"}; do
    if [[ "$path" == "$file" ]]; then guarded=true; fi
  done
done
echo "guarded=$guarded"
