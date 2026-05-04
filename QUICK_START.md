# 🚀 Quick Start Guide - EziHR API + Next.js

## TL;DR - Get Running in 5 Minutes

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
# Backend runs on http://localhost:8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### 3. Test API
```bash
curl http://localhost:8000/attendance/iclock/getrequest/
# Response: {"status":"ok"}
```

---

## What Changed

| Before | After |
|--------|-------|
| Django Templates (HTML) | Pure REST API (JSON) |
| Form-based Login | Token/Session Auth (API) |
| Server-side Rendering | Client-side React (Next.js) |
| TBD Frontend | Next.js + TypeScript |

---

## Key Files

### Backend
- `backend/attendance/views.py` - API endpoints (DRF)
- `backend/attendance/urls.py` - URL routing
- `backend/attendance/serializers.py` - Model → JSON conversion
- `backend/backend/settings.py` - Django configuration + DRF + CORS
- `backend/requirements.txt` - Dependencies

### Frontend
- `frontend/app/` - Next.js pages
- `frontend/public/` - Static assets
- `frontend/package.json` - Dependencies

---

## API Endpoints (Currently Available)

✅ **Working Now:**
- `GET /attendance/iclock/getrequest/` - Device heartbeat
- `POST /attendance/iclock/getrequest/` - Device heartbeat (POST)
- `GET /attendance/iclock/cdata/` - Device data sync
- `POST /attendance/iclock/cdata/` - Device data sync
- `GET /attendance/api/dashboard/` - Dashboard (requires admin login)

⏳ **To Be Implemented:**
- `/api/auth/login/` - User authentication
- `/api/auth/logout/` - Logout
- `/api/auth/user/` - Current user info
- `/api/employees/` - Employee CRUD
- `/api/attendance-events/` - Event records
- `/api/daily-attendance/` - Daily attendance records

---

## Development URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | React/Next.js UI |
| API | http://localhost:8000 | Django REST API |
| Admin | http://localhost:8000/admin/ | Django Admin Panel |

---

## Environment Variables

### Backend (`.env`)
```env
# Usually not needed for local dev, but useful for production
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3
```

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE=/api
```

---

## Common Issues & Fixes

### CORS Error: "Access to XMLHttpRequest blocked"
**Fix:** Check `CORS_ALLOWED_ORIGINS` in `settings.py`
```python
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',  # Ensure this is set
]
```

### API Returns 404
**Fix:** Ensure endpoint path is correct:
- `GET /attendance/iclock/getrequest/` ✅ (has trailing slash)
- `GET /attendance/iclock/getrequest` ❌ (missing slash)

### "ModuleNotFoundError: No module named 'rest_framework'"
**Fix:** Install requirements
```bash
pip install -r requirements.txt
```

### Frontend Can't Connect to API
**Fix:** Check if both servers are running:
```bash
# Check Django
curl http://localhost:8000

# Check Next.js
curl http://localhost:3000
```

---

## Next Steps

1. **Implement Authentication Endpoint**
   - Add `/api/auth/login/` endpoint
   - Add `/api/auth/logout/` endpoint
   - Add `/api/auth/user/` endpoint

2. **Create CRUD ViewSets**
   - Employees
   - Attendance Events
   - Daily Attendance

3. **Build Frontend Pages**
   - Login page
   - Dashboard
   - Employee list
   - Attendance records

4. **Add Frontend API Client**
   - Create `lib/api-client.ts`
   - Create custom hooks for data fetching
   - Handle authentication state

5. **Testing**
   - Write unit tests
   - Write integration tests
   - Test API endpoints with Postman

---

## Useful Commands

### Django
```bash
# Run dev server
python manage.py runserver

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Shell (Python REPL with Django context)
python manage.py shell

# Make migrations
python manage.py makemigrations
```

### Next.js
```bash
# Dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Linting
npm run lint
```

---

## Deployment Checklist

- [ ] Set `DEBUG=False` in Django settings
- [ ] Update `ALLOWED_HOSTS` with your domain
- [ ] Update `CORS_ALLOWED_ORIGINS` with frontend domain
- [ ] Use PostgreSQL instead of SQLite
- [ ] Set environment variables for secrets
- [ ] Enable HTTPS
- [ ] Use Gunicorn + Nginx for backend
- [ ] Deploy frontend to Vercel or similar
- [ ] Set up CI/CD pipeline
- [ ] Configure logging and monitoring

---

## Documentation Files

- **MIGRATION_SUMMARY.md** - Complete migration details
- **API_MIGRATION.md** - API endpoint documentation
- **FRONTEND_SETUP.md** - Frontend integration guide

---

## Quick Links

- [Django REST Framework Docs](https://www.django-rest-framework.org/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Django Documentation](https://docs.djangoproject.com/)
- [React Documentation](https://react.dev/)

---

**Status:** ✅ Backend API ready | ⏳ Frontend pages pending | ⏳ Auth endpoints pending

Ready to build! 🚀
