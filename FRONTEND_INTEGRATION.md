# Frontend-Backend Integration Guide

## What's Been Set Up

Your Next.js frontend is now fully integrated with the Django REST API backend.

### Files Created/Modified

**API Integration:**
- `lib/api-client.ts` - TypeScript API client with full type safety
- `lib/hooks/useApi.ts` - Custom hook for data fetching
- `lib/hooks/useAuth.ts` - Authentication hook (ready to use)
- `.env.local` - Environment variables for API connection

**Components:**
- `components/AttendanceTable.tsx` - Reusable table component
- `components/StatCard.tsx` - Reusable stat display card

**Pages:**
- `app/page.tsx` - Dashboard page integrated with API
- `app/layout.tsx` - Updated with proper metadata

## How to Use

### 1. Start Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
python manage.py runserver
# Output: Starting development server at http://localhost:8000/
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Output: ▲ Next.js [...] ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### 2. Access the Dashboard

Open your browser and go to: **http://localhost:3000**

You should see the attendance dashboard with:
- ✅ Real-time data fetched from the backend API
- ✅ Employee attendance records
- ✅ Statistics (Total Employees, Present Today, Average Work Time)
- ✅ Loading and error states properly handled

## API Integration Architecture

```typescript
// lib/api-client.ts structure:
export const apiClient = {
  dashboard: {
    getAttendance() → GET /attendance/api/dashboard/
  },
  device: {
    heartbeat() → GET /attendance/iclock/getrequest/
    sendData(data) → POST /attendance/iclock/cdata/
  },
  auth: {
    login(username, password) → POST /api/auth/login/
    logout() → POST /api/auth/logout/
    getCurrentUser() → GET /api/auth/user/
  }
}
```

## Using the API Client

### In Your Components

```typescript
'use client';

import { useApi } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api-client';

export function MyComponent() {
  // Fetch data
  const { data, loading, error, refetch } = useApi(
    () => apiClient.dashboard.getAttendance()
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Display data */}</div>;
}
```

### Direct API Calls

```typescript
// For one-time calls or actions
const data = await apiClient.dashboard.getAttendance();

// For device sync
await apiClient.device.sendData({
  SN: 'device001',
  PIN: '12345',
  event_code: '0'
});
```

## Adding New Endpoints

### Step 1: Update API Client

```typescript
// lib/api-client.ts
auth = {
  login: (username: string, password: string) =>
    this.request('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  // ... more endpoints
};
```

### Step 2: Use in Component

```typescript
const handleLogin = async (username: string, password: string) => {
  try {
    await apiClient.auth.login(username, password);
    // Handle success
  } catch (error) {
    // Handle error
  }
};
```

## Environment Variables

The `.env.local` file controls API connection:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### For Production

Create `.env.production.local`:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## Features Implemented

### ✅ Type-Safe API Client
- Full TypeScript support
- Automatic error handling
- Request/response types

### ✅ Data Fetching Hook
- Automatic loading/error states
- Manual refetch capability
- Dependency-based updates

### ✅ Authentication Hook (Ready)
- User authentication methods
- Authentication state management
- Logout functionality

### ✅ Dashboard Page
- Real-time attendance data
- Employee statistics
- Professional UI with Tailwind

### ✅ Reusable Components
- AttendanceTable component
- StatCard component
- Loading/error states

## CORS Handling

The backend is configured to accept requests from `localhost:3000`:

```python
# backend/settings.py
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
```

For production, update with your frontend domain.

## Error Handling

The integration includes comprehensive error handling:

```typescript
// API errors automatically caught
const { data, error } = useApi(...);

if (error) {
  console.error(error.message); // "API Error: 404"
}

// Connection errors shown to user
if (error?.message.includes('Connection')) {
  // Show "Backend not running" message
}
```

## Next Steps

### 1. Implement Authentication
- [ ] Create login page using `useAuth` hook
- [ ] Add login endpoint to backend (`/api/auth/login/`)
- [ ] Implement logout functionality
- [ ] Add protected routes

### 2. Create More Pages
- [ ] Employee management page
- [ ] Attendance records page
- [ ] Reports page
- [ ] Settings page

### 3. Add More Components
- [ ] Navigation/Header component
- [ ] Sidebar component
- [ ] Form components
- [ ] Modal/Dialog components

### 4. Enhance Dashboard
- [ ] Add date range filters
- [ ] Add export functionality
- [ ] Add real-time refresh
- [ ] Add attendance analytics

### 5. Backend Integration
- [ ] Complete auth endpoints
- [ ] Complete CRUD endpoints
- [ ] Add pagination
- [ ] Add filtering/search

## Testing the Integration

### Quick Test

```bash
# In frontend folder
curl http://localhost:8000/attendance/api/dashboard/ \
  -H "Content-Type: application/json"
```

### Frontend Test

Open browser DevTools (F12) → Network tab → Reload page → Watch API calls

### Mock Data

For testing without backend:

```typescript
// In useApi.ts, add mock fallback
if (process.env.NODE_ENV === 'development') {
  return mockData; // Your test data
}
```

## Troubleshooting

### Issue: "Backend not reachable"

**Solution:**
1. Ensure backend is running: `python manage.py runserver`
2. Check `.env.local` has correct API_URL
3. Verify CORS is enabled in backend

### Issue: API returns 404

**Solution:**
1. Check endpoint path in api-client.ts
2. Verify endpoint exists in backend urls.py
3. Add trailing slash if missing

### Issue: TypeScript errors

**Solution:**
1. Rebuild TypeScript: `npm run build`
2. Clear node_modules: `rm -rf node_modules && npm install`
3. Check types in interfaces

## Documentation Structure

```
frontend/
├── lib/
│   ├── api-client.ts      # API client with methods
│   └── hooks/
│       ├── useApi.ts      # Data fetching hook
│       └── useAuth.ts     # Authentication hook
├── components/
│   ├── AttendanceTable.tsx
│   └── StatCard.tsx
├── app/
│   ├── page.tsx           # Dashboard page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
└── .env.local             # Environment config
```

## API Response Types

All API responses are typed for type safety:

```typescript
// DashboardData
{
  attendance_rows: AttendanceRow[];
  attendance_date: string;
}

// AttendanceRow
{
  employee_code: string;
  employee_name: string;
  attendance_date: string;
  first_check_in?: string;
  last_check_out?: string;
  worked_minutes: number;
}
```

## Performance Tips

1. **Use `useApi` hook** for automatic caching
2. **Memoize components** to prevent re-renders
3. **Lazy load pages** with dynamic imports
4. **Optimize images** with Next.js Image component
5. **Use React DevTools** to monitor renders

## Ready to Deploy

Once you've:
- ✅ Tested locally
- ✅ Implemented all endpoints
- ✅ Added all pages/components
- ✅ Set environment variables

You can deploy to:
- **Frontend:** Vercel, Netlify, AWS Amplify
- **Backend:** Heroku, AWS EC2, DigitalOcean

## Support

For help with:
- **Next.js:** https://nextjs.org/docs
- **Django REST:** https://www.django-rest-framework.org/
- **React Hooks:** https://react.dev/reference/react

Happy coding! 🚀
