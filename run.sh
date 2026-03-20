#!/bin/bash
cd "$(dirname "$0")"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r backend/requirements.txt

echo ""
echo "Starting City Clean Air Compass at http://localhost:8000"
echo ""
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
