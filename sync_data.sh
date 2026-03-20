#!/bin/bash
# Sync data from the Clean Air Compass data repo and re-run ETL.
#
# Usage:
#   ./sync_data.sh                          # uses default sibling directory
#   ./sync_data.sh /path/to/data/repo       # custom path
#
set -e
cd "$(dirname "$0")"

DATA_REPO="${1:-../Clean_Air_Compass_for_Cities-data}"

if [ -d "$DATA_REPO/.git" ]; then
  echo "Pulling latest data from $(cd "$DATA_REPO" && git remote get-url origin)..."
  (cd "$DATA_REPO" && git pull origin main)
else
  echo "Using data directory: $DATA_REPO (not a git repo, skipping pull)"
fi

echo ""
echo "Running ETL..."
source venv/bin/activate 2>/dev/null || true
python3 backend/etl/run_etl.py --source "$DATA_REPO"

echo ""
echo "Done! Restart the server to pick up new data."
