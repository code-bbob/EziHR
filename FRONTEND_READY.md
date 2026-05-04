# 🚀 EziHR Frontend-Backend Integration Complete

## Overview

The Next.js frontend is now **fully integrated** with the Django REST API backend. The dashboard automatically fetches and displays real-time attendance data.

## Quick Start (60 seconds)

### Option 1: Run Both Servers (Recommended)

```bash
# Make script executable (first time only)
chmod +x start-dev.sh

# Run both servers
./start-dev.sh
```

### Option 2: Manual Start (Two Terminals)

**Terminal 1 - Backend:**
```bash
cd backend
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open: **http://localhost:3000** 🎉

## What's Working

✅ **Dashboard Page** - Real-time attendance data from API  
✅ **API Client** - Type-safe TypeScript API integration  
✅ **Error Handling** - Connection errors shown to user  
✅ **Loading States** - Professional loading animations  
✅ **Responsive Design** - Works on mobile and desktop  
✅ **Dark Mode Support** - Auto dark mode with Tailwind  

## Architecture

```
┌─────────────────────────────────────┐
│         Next.js Frontend             │
│      http://localhost:3000           │
│                                       │
│  ✓ Dashboard Page                    │
│  ✓ React Components                  │
│  ✓ Tailwind CSS UI                   │
└─────────────┬─────────────────────────┘
              │ HTTP/JSON
              ↓
┌─────────────────────────────────────┐
│       Django REST API                │
│      http://localhost:8000           │
│                                       │
│  GET  /attendance/api/dashboard/     │
│  POST /attendance/iclock/cdata/      │
│  GET  /attendance/iclock/getrequest/ │
└─────────────┬─────────────────────────┘
              │ ORM
              ↓
┌─────────────────────────────────────┐
│       SQLite Database                │
│                                       │
│  ✓ Employees                         │
│  ✓ Attendance Events                 │
│  ✓ Daily Attendance                  │
└─────────────────────────────────────┘
```

## File Structure

```
frontend/
├── app/
│   ├── page.tsx                  # Dashboard page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── lib/
│   ├── api-client.ts             # API client methods
│   └── hooks/
│       ├── useApi.ts             # Data fetching hook
│       └── useAuth.ts            # Auth hook
├── components/
│   ├── AttendanceTable.tsx       # Table component
│   └── StatCard.tsx              # Card component
├── .env.local                    # API configuration
└── package.json                  # Dependencies
```

## Key Integration Points

### 1. API Client (`lib/api-client.ts`)

Provides type-safe methods to call the backend:

```typescript
await apiClient.dashboard.getAttendance()
await apiClient.device.heartbeat()
await apiClient.device.sendData(payload)
```

### 2. Data Fetching Hook (`lib/hooks/useApi.ts`)

Simplifies data fetching with loading/error states:

```typescript
const { data, loading, error, refetch } = useApi(
  () => apiClient.dashboard.getAttendance()
);
```

### 3. Dashboard Page (`app/page.tsx`)

Uses the hook to fetch and display attendance data with:
- Real-time statistics
- Employee table
- Error handling
- Loading states

## Accessing the APIs

### From Frontend

```typescript
// In any client component
import { apiClient } from '@/lib/api-client';

const data = await apiClient.dashboard.getAttendance();
```

### From Browser Console

```javascript
// Check network tab in DevTools (F12)
// Look for requests to http://localhost:8000/attendance/api/dashboard/
```

### From Terminal

```bash
curl http://localhost:8000/attendance/api/dashboard/ \
  -H "Content-Type: application/json"
```

## Environment Configuration

The `.env.local` file controls API connection:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE=/api
```

**Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## Troubleshooting

### ❌ "Cannot connect to backend"

**Check:**
1. Is backend running? (http://localhost:8000 in browser)
2. Is frontend pointing to correct API URL?
3. Are CORS headers correct?

**Fix:**
```bash
# Terminal 1: Restart backend
cd backend && python manage.py runserver

# Terminal 2: Restart frontend
cd frontend && npm run dev
```

### ❌ "Data not loading"

**Check:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload page
4. Look for request to `/attendance/api/dashboard/`
5. Check response status (should be 200)

**Fix:**
```bash
# Clear cache and rebuild
cd frontend
rm -rf .next
npm run dev
```

### ❌ "TypeScript errors"

**Fix:**
```bash
cd frontend
npm run build  # Check for errors
npx tsc --noEmit  # Type check
```

## Adding New Pages

### Example: Employees Page

1. **Create component** (`components/EmployeeList.tsx`):
```typescript
export function EmployeeList() {
  const { data, loading } = useApi(
    () => apiClient.employees.list()
  );
  // ... render list
}
```

2. **Create page** (`app/employees/page.tsx`):
```typescript
'use client';
import { EmployeeList } from '@/components/EmployeeList';

export default function EmployeesPage() {
  return <EmployeeList />;
}
```

3. **Add to API client** (`lib/api-client.ts`):
```typescript
employees = {
  list: () => this.request('/api/employees/'),
  get: (id: number) => this.request(`/api/employees/${id}/`),
};
```

## Adding New API Endpoints

### Backend (Django)

1. Create view in `views.py`
2. Add serializer in `serializers.py`
3. Register in `urls.py`

### Frontend

1. Add method to `apiClient` in `lib/api-client.ts`
2. Use in component with `useApi` hook
3. Handle loading/error states

## Testing the Integration

### Test Dashboard Page

```bash
# 1. Start both servers
./start-dev.sh

# 2. Open browser
open http://localhost:3000

# 3. You should see:
# - Attendance Dashboard title
# - Date display
# - Employee table with data
# - Statistics cards
```

### Test API Directly

```bash
# Check if backend is running
curl http://localhost:8000/attendance/iclock/getrequest/
# Response: {"status":"ok"}

# Check dashboard endpoint
curl http://localhost:8000/attendance/api/dashboard/
# Response: {"attendance_rows":[...],"attendance_date":"..."}
```

### Test in Browser

```javascript
// Open console (F12) and run:
fetch('http://localhost:8000/attendance/api/dashboard/', {
  credentials: 'include'
})
.then(r => r.json())
.then(d => console.log(d));
```

## Performance

### Optimization Tips

1. **Memoize Components**
```typescript
const MemoizedTable = memo(AttendanceTable);
```

2. **Lazy Load Pages**
```typescript
const EmployeesPage = lazy(() => import('./employees'));
```

3. **Cache Data**
```typescript
const { data } = useApi(..., []);  // Cache indefinitely
```

4. **Pagination**
```typescript
// Add to API calls
?page=1&limit=20
```

## Deployment

### Frontend Deployment (Vercel)

```bash
# Automatic deployment on push
# Just connect your GitHub repo at vercel.com
# Environment variable: NEXT_PUBLIC_API_URL
```

### Backend Deployment

Update API URL for production:
```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

## Security Notes

- ✅ CORS is configured for localhost:3000
- ✅ API URL is configurable via environment variables
- ⚠️ Don't expose SECRET_KEY in frontend
- ⚠️ Update CORS origins for production domain

## Next Steps

### Immediate (Today)
- [x] Dashboard working with real data
- [ ] Test authentication endpoints
- [ ] Add login page

### Short Term (This Week)
- [ ] Complete auth flows
- [ ] Add employee management
- [ ] Add attendance records view

### Medium Term (This Month)
- [ ] Add reports/exports
- [ ] Performance optimization
- [ ] Mobile app consideration

## API Reference

### Dashboard Endpoint
```
GET /attendance/api/dashboard/
Response: {
  "attendance_rows": [
    {
      "employee_code": "EMP001",
      "employee_name": "John Doe",
      "first_check_in": "2026-04-28T09:30:00",
      "last_check_out": "2026-04-28T17:30:00",
      "worked_minutes": 480
    }
  ],
  "attendance_date": "2026-04-28"
}
```

### Device Endpoints
```
GET/POST /attendance/iclock/getrequest/
Response: {"status":"ok"}

POST /attendance/iclock/cdata/
Body: {
  "SN": "device001",
  "PIN": "12345",
  "event_code": "0"
}
Response: {"status":"ok"}
```

## Support

- **Frontend Help:** https://nextjs.org/docs
- **Backend Help:** https://www.django-rest-framework.org/
- **API Issues:** Check network tab in DevTools (F12)

## Status

🟢 **Integration Complete and Working!**

- Backend API: ✅ Running
- Frontend: ✅ Integrated
- Dashboard: ✅ Displaying real data
- Error handling: ✅ Implemented
- Type safety: ✅ Full TypeScript support

---

**Start developing with:** `./start-dev.sh` then open http://localhost:3000

Enjoy! 🎉
