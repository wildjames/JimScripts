#!/usr/bin/env bash
# prescribe-parallel.sh — Create and submit N prescriptions in parallel to the same pharmacy.
#
# Usage:
#   ./prescribe-parallel.sh --count 5 --pharmacy-ods JW1234
#   ./prescribe-parallel.sh -n 10 -p JW1234 --max-parallel 4 --max-retries 5

set -euo pipefail

# Defaults
COUNT=1
PHARMACY_ODS=""
MAX_PARALLEL=4
MAX_RETRIES=5
INITIAL_BACKOFF=2
SAVE_DIR="./data/prescriptions"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Create and submit N prescriptions in parallel to the same pharmacy.

Options:
  -n, --count <number>         Number of prescriptions to create (default: $COUNT)
  -p, --pharmacy-ods <code>    Pharmacy ODS code (required)
  --max-parallel <number>      Max concurrent submissions (default: $MAX_PARALLEL)
  --max-retries <number>       Max retries per prescription (default: $MAX_RETRIES)
  --initial-backoff <seconds>  Initial backoff in seconds (default: $INITIAL_BACKOFF)
  --save-dir <dir>             Output directory (default: $SAVE_DIR)
  -h, --help                   Show this help
EOF
  exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--count) COUNT="$2"; shift 2 ;;
    -p|--pharmacy-ods) PHARMACY_ODS="$2"; shift 2 ;;
    --max-parallel) MAX_PARALLEL="$2"; shift 2 ;;
    --max-retries) MAX_RETRIES="$2"; shift 2 ;;
    --initial-backoff) INITIAL_BACKOFF="$2"; shift 2 ;;
    --save-dir) SAVE_DIR="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PHARMACY_ODS" ]]; then
  echo "Error: --pharmacy-ods is required" >&2
  exit 1
fi

mkdir -p "$SAVE_DIR"

# Worker function: create a bundle then submit it with retries
prescribe_one() {
  local index="$1"
  local pharmacy_ods="$2"
  local max_retries="$3"
  local initial_backoff="$4"
  local save_dir="$5"
  local prefix="[Rx $index]"

  # Step 1: Create the prescription bundle
  echo "$prefix Creating prescription bundle..."
  local bundle_output
  bundle_output=$(create-prescription-bundle --pharmacy-ods "$pharmacy_ods" --save-dir "$save_dir" 2>&1)
  local bundle_file
  bundle_file=$(echo "$bundle_output" | grep -E '\.json$' | tail -1)

  if [[ -z "$bundle_file" ]]; then
    echo "$prefix ERROR: Failed to create bundle. Output:" >&2
    echo "$bundle_output" >&2
    return 1
  fi
  echo "$prefix Bundle created: $bundle_file"

  # Step 2: Submit with retry logic
  local attempt=0
  local backoff="$initial_backoff"

  while [[ $attempt -lt $max_retries ]]; do
    attempt=$((attempt + 1))
    echo "$prefix Attempt $attempt/$max_retries — submitting..."

    local output
    local exit_code=0
    output=$(fhir-prescribing --action create --input "$bundle_file" 2>&1) || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
      # Check for success in output
      if echo "$output" | grep -q "Response: 200\|Response: 2[0-9][0-9]"; then
        echo "$prefix SUCCESS on attempt $attempt"
        echo "$output" | grep -E "Request ID:|Correlation ID:|Response:" | sed "s/^/$prefix   /"
        return 0
      fi
    fi

    # Extract Retry-After if present in the error body
    local retry_after
    retry_after=$(echo "$output" | grep -ioP 'retry-after["\s:]+\K[0-9]+' | head -1 || true)

    if [[ -n "$retry_after" ]]; then
      backoff="$retry_after"
      echo "$prefix Server requested Retry-After: ${backoff}s"
    fi

    # Check for 429 (rate limited) or 5xx (server error) — these are retryable
    if echo "$output" | grep -qE "failed: (429|5[0-9]{2})"; then
      echo "$prefix Retryable error (attempt $attempt). Waiting ${backoff}s..."
    elif echo "$output" | grep -qE "failed: 4[0-9]{2}"; then
      # 4xx (not 429) is a client error — don't retry
      echo "$prefix NON-RETRYABLE client error on attempt $attempt:" >&2
      echo "$output" | tail -5 | sed "s/^/$prefix   /" >&2
      return 1
    else
      # Unknown failure — retry with backoff
      echo "$prefix Error on attempt $attempt. Waiting ${backoff}s..."
    fi

    if [[ $attempt -lt $max_retries ]]; then
      sleep "$backoff"
      # Exponential backoff with jitter (cap at 60s)
      backoff=$(awk "BEGIN {b = $backoff * 2; if (b > 60) b = 60; printf \"%.0f\", b + rand() * 2}")
    fi
  done

  echo "$prefix FAILED after $max_retries attempts" >&2
  echo "$output" | tail -5 | sed "s/^/$prefix   /" >&2
  return 1
}

export -f prescribe_one

echo "============================================="
echo "Parallel Prescription Creator"
echo "============================================="
echo "Pharmacy ODS:    $PHARMACY_ODS"
echo "Count:           $COUNT"
echo "Max parallel:    $MAX_PARALLEL"
echo "Max retries:     $MAX_RETRIES"
echo "Initial backoff: ${INITIAL_BACKOFF}s"
echo "Save dir:        $SAVE_DIR"
echo "============================================="
echo ""

# Run prescriptions in parallel using xargs
# Each job gets: index, pharmacy_ods, max_retries, initial_backoff, save_dir
FAILURES=0
seq 1 "$COUNT" | xargs -P "$MAX_PARALLEL" -I {} bash -c \
  'prescribe_one "$@"' _ {} "$PHARMACY_ODS" "$MAX_RETRIES" "$INITIAL_BACKOFF" "$SAVE_DIR" || FAILURES=$?

echo ""
echo "============================================="
if [[ $FAILURES -eq 0 ]]; then
  echo "All $COUNT prescriptions submitted successfully."
else
  echo "Some prescriptions failed. Check output above for details."
  exit 1
fi
