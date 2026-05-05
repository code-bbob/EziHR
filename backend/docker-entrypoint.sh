#!/bin/sh
set -e

echo "===> Making migrations (auto-detect model changes)..."
python manage.py makemigrations enterprise device attendance userauth  --noinput

# 1. Apply database migrations
echo "===> Running migrations..."
python manage.py migrate --noinput

# 2. (Optional) Re-collect static files if anything changed
echo "===> Collecting static files..."
python manage.py collectstatic --noinput

# 3. Finally, run the provided command (e.g. Gunicorn)
echo "===> Starting application: $*"
exec "$@"
