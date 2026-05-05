# API Migration Guide

## Summary of Changes

The EziHR backend has been converted from a Django template-based application to a **pure REST API** architecture. The frontend is now entirely powered by **Next.js**.

## What Changed

### Backend (Django)
- ✅ Removed all Django templates from `attendance/templates/`
- ✅ Converted template views to DRF APIView endpoints
- ✅ Added Django REST Framework (DRF) for JSON responses
- ✅ Added django-cors-headers for cross-origin requests from Next.js
- ✅ Removed LoginView/LogoutView template-based auth
- ✅ Created `serializers.py` with DRF serializers

### What's Removed
- `attendance/templates/` directory (all HTML files)
- `AttendanceLoginView` and `AttendanceLogoutView` (Django template-based auth)
- Template rendering logic
- Session-based template context processors
- Old authentication redirects

## API Endpoints

### Dashboard
- **GET** `/attendance/api/dashboard/`
  - **Permission**: IsAuthenticated, IsAdminRole
  - **Response**: Dashboard data with attendance rows and date
  ```json
  {
    "attendance_rows": [...],
    "attendance_date": "2026-04-28"
  }
  ```

### iClock Device Integration
- **GET/POST** `/attendance/iclock/cdata/`
  - Device attendance data endpoint
  - Returns: `{"status": "ok", "message": "...", "timestamp": "..."}`

- **GET/POST** `/attendance/iclock/getrequest/`
  - Device heartbeat/keepalive endpoint
  - Returns: `{"status": "ok"}`

## Required Frontend Implementation

### Authentication Flow
Since template-based login/logout is removed, you need to:

1. **Create an Authentication API** (if not using Django's built-in session auth):
   - Create a login endpoint that returns JWT or session token
   - Handle logout on the frontend

2. **Or use Django Session Auth**:
   - POST `/api/login/` with credentials
   - Use CSRF token for requests
   - Configure CORS properly

### Setup Instructions

1. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Run Migrations**
   ```bash
   python manage.py migrate
   ```

3. **Configure CORS** (Already done in settings.py)
   - Frontend running on `http://localhost:3000`
   - Update `CORS_ALLOWED_ORIGINS` in `settings.py` for production URLs

4. **Start API Server**
   ```bash
   python manage.py runserver
   ```

5. **Start Next.js Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Frontend API Integration Example

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchDashboard() {
  const response = await fetch(`${API_URL}/attendance/api/dashboard/`, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // For session auth
  });
  return response.json();
}

export async function fetchEmployees() {
  const response = await fetch(`${API_URL}/api/employees/`, {
    credentials: 'include',
  });
  return response.json();
}
```

## Django REST Framework Configuration

The following is configured in `settings.py`:

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]

CORS_ALLOW_CREDENTIALS = True
```

## Next Steps

1. Create API endpoints for employee and attendance management (currently only dashboard exists)
2. Implement frontend authentication (login/register forms)
3. Create dashboard page to consume `/attendance/api/dashboard/`
4. Build employee attendance tracking UI
5. Add JWT authentication if needed (install `djangorestframework-simplejwt`)

## Optional: Add JWT Authentication

If you prefer token-based auth instead of session auth:

```bash
pip install djangorestframework-simplejwt
```

Then update `settings.py`:
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}
```

And add to `urls.py`:
```python
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
```
