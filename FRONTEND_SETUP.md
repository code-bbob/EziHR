# Next.js Frontend Setup for EziHR API

## Environment Variables

Create a `.env.local` file in the frontend directory:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE=/api

# Features
NEXT_PUBLIC_ENABLE_DEBUG=false
```

## API Client Setup

### 1. Create API Client (`lib/api-client.ts`)

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session auth
      ...options,
    };

    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
  },

  // Dashboard
  dashboard: {
    getAttendanceData() {
      return apiClient.request('/attendance/api/dashboard/');
    },
  },

  // Employees
  employees: {
    list() {
      return apiClient.request('/api/employees/');
    },
    get(id: number) {
      return apiClient.request(`/api/employees/${id}/`);
    },
  },

  // Attendance Events
  events: {
    list() {
      return apiClient.request('/api/attendance-events/');
    },
    getByEmployee(employeeId: number) {
      return apiClient.request(`/api/employees/${employeeId}/events/`);
    },
  },

  // Daily Attendance
  attendance: {
    getDaily(date?: string) {
      const query = date ? `?date=${date}` : '';
      return apiClient.request(`/api/daily-attendance/${query}`);
    },
  },
};
```

### 2. Create Authentication Hook (`lib/hooks/useAuth.ts`)

```typescript
import { useEffect, useState } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch current user
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/user/`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) setUser(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const logout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (err) {
      setError(String(err));
    }
  };

  return { user, loading, error, logout };
}
```

### 3. Create Pages for Dashboard

```typescript
// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/hooks/useAuth';

export default function DashboardPage() {
  const { user, loading: userLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;

    if (!user?.is_staff) {
      setError('You do not have access to the dashboard');
      setLoading(false);
      return;
    }

    apiClient.dashboard
      .getAttendanceData()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, userLoading]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Attendance Dashboard</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

## Installation & Running

### Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Admin: http://localhost:8000/admin

## Next Steps

1. ✅ Backend is now pure API (Django REST Framework)
2. ✅ CORS is configured for local development
3. ✅ Serializers are ready for Employee, AttendanceEvent, DailyAttendance
4. Create additional API endpoints for:
   - `/api/employees/` - Employee list/detail (GET, POST, PUT, DELETE)
   - `/api/daily-attendance/` - Daily attendance records
   - `/api/attendance-events/` - Attendance events list
5. Implement authentication endpoints:
   - `/api/auth/login/` - User login
   - `/api/auth/logout/` - User logout
   - `/api/auth/user/` - Get current user
6. Build Next.js pages and components for UI

## Useful Resources

- [Django REST Framework Docs](https://www.django-rest-framework.org/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [CORS with Django](https://github.com/adamchainz/django-cors-headers)
