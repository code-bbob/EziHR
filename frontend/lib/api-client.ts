// lib/api-client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface TokenStorage {
  access: string | null;
  refresh: string | null;
}

let tokenStorage: TokenStorage = {
  access: null,
  refresh: null,
};

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function normalizeToken(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Load tokens from localStorage on initialization
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('tokens');
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<TokenStorage>;
      tokenStorage = {
        access: normalizeToken(parsed.access),
        refresh: normalizeToken(parsed.refresh),
      };
    }
  } catch (e) {
    console.error('Failed to load tokens from localStorage');
  }
}

export function setTokens(access: string, refresh: string) {
  tokenStorage = {
    access: normalizeToken(access),
    refresh: normalizeToken(refresh),
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem('tokens', JSON.stringify(tokenStorage));
  }
}

export function clearTokens() {
  tokenStorage = { access: null, refresh: null };
  if (typeof window !== 'undefined') {
    localStorage.removeItem('tokens');
  }
}

export function getAccessToken() {
  return normalizeToken(tokenStorage.access);
}

function getRefreshToken() {
  return normalizeToken(tokenStorage.refresh);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/userauth/api/refresh-token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.access) {
        setTokens(data.access, data.refresh || refreshToken);
        return data.access;
      }
    } else {
      clearTokens();
    }
  } catch (err) {
    clearTokens();
  }

  return null;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  detail?: string;
}

export interface AttendanceRow {
  employee: {
    id: number;
    employee_code: string;
    name: string;
  };
  present: boolean;
  check_in?: string | null;
  check_out?: string | null;
  break_sessions?: Array<{
    break_out?: string | null;
    break_in?: string | null;
  }>;
  break_out?: string | null;
  break_in?: string | null;
  ot_in?: string | null;
  ot_out?: string | null;
  worked_minutes: number;
  summary?: {
    id: number;
    employee: number;
    attendance_date: string;
    first_check_in?: string | null;
    last_check_out?: string | null;
    worked_minutes: number;
    worked_hours: number;
    present: boolean;
    last_event_type?: number | null;
    last_event_time?: string | null;
  };
}

export interface DashboardData {
  attendance_rows: AttendanceRow[];
  attendance_date: string;
  stats: {
    total_employees: number;
    present_today: number;
    absent_today: number;
    average_worked_minutes: number;
    average_worked_hours: number;
    highest_working_time: {
      employee: {
        id: number;
        employee_code: string;
        name: string;
      } | null;
      worked_minutes: number;
      worked_hours: number;
    } | null;
    lowest_working_time: {
      employee: {
        id: number;
        employee_code: string;
        name: string;
      } | null;
      worked_minutes: number;
      worked_hours: number;
    } | null;
  };
}

export interface DashboardStats {
  total_employees: number;
  present_today: number;
  absent_today: number;
  average_worked_minutes: number;
  average_worked_hours: number;
  highest_working_time: {
    employee: { id: number; employee_code: string; name: string } | null;
    worked_minutes: number;
    worked_hours: number;
  } | null;
  lowest_working_time: {
    employee: { id: number; employee_code: string; name: string } | null;
    worked_minutes: number;
    worked_hours: number;
  } | null;
}

export interface DepartmentSummary {
  id: number;
  name: string;
  branch_id: number | null;
  stats: DashboardStats;
  attendance_rows?: AttendanceRow[];
}

export interface BranchSummary {
  id: number;
  name: string;
  stats: DashboardStats;
  departments: DepartmentSummary[];
}

export interface EnterpriseSummary {
  id: number;
  name: string;
  branches: BranchSummary[];
  departments: DepartmentSummary[];
}


export interface HierarchicalDashboardData {
  enterprise: EnterpriseSummary;
  attendance_date: string;
}

export interface BranchDashboardData {
  branch: BranchSummary & { attendance_rows?: AttendanceRow[] };
  enterprise?: {
    id: number;
    name: string;
    branches: Array<{ id: number; name: string }>;
  };
  attendance_date: string;
}

export interface DepartmentDashboardData {
  department: DepartmentSummary;
  enterprise?: {
    id: number;
    name: string;
    branches: Array<{ id: number; name: string }>;
  };
  branch?: {
    id: number;
    name: string;
    departments: Array<{ id: number; name: string; branch_id?: number | null }>;
  };
  attendance_date: string;
}

export interface EnterpriseBranchDepartment {
  id: number;
  name: string;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  created_at?: string;
}

export interface AttendanceRowWithLateness extends AttendanceRow {
  late_seconds?: number;
  late_duration?: string | null;
  early_seconds?: number;
  early_duration?: string | null;
  scheduled_arrival?: string;
  scheduled_departure?: string;
}

export interface LateArrivalItem {
  employee: AttendanceRow['employee'];
  check_in: string;
  scheduled_arrival: string;
  late_seconds: number;
  late_minutes: number;
  summary?: AttendanceRow['summary'];
}

export interface EarlyDepartureItem {
  employee: AttendanceRow['employee'];
  check_out: string;
  scheduled_departure: string;
  early_seconds: number;
  early_minutes: number;
  summary?: AttendanceRow['summary'];
}

export interface LateArrivalsData {
  late_arrivals: LateArrivalItem[];
  count: number;
  attendance_date: string;
}

export interface EarlyDeparturesData {
  early_departures: EarlyDepartureItem[];
  count: number;
  attendance_date: string;
}

export interface EnterpriseHierarchyItem {
  id: number;
  name: string;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  licensed?: boolean;
  licensed_until?: string | null;
  max_alowed_employees?: number;
  branches: EnterpriseBranchDepartment[];
  departments: Array<{
    id: number;
    name: string;
    branch: EnterpriseBranchDepartment | null;
    created_at?: string;
  }>;
}

class ApiClient {
  private baseUrl = API_BASE;

  async request<T>(
    endpoint: string,
    options: RequestInit & { skipAuth?: boolean } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Add JWT token if available
    const token = options.skipAuth ? null : getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const defaultOptions: RequestInit = {
      credentials: 'include',
      ...options,
      headers,
    };

    let response = await fetch(url, defaultOptions);

    // If we get 401 and have a refresh token, try to refresh and retry
    if (response.status === 401 && !options.skipAuth && getRefreshToken()) {
      // Only attempt refresh if not already refreshing to avoid multiple concurrent refresh calls
      if (!isRefreshing) {
        isRefreshing = true;
        const newAccessToken = await refreshAccessToken();
        isRefreshing = false;

        if (newAccessToken) {
          // Retry the request with the new token
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          const retryOptions: RequestInit = {
            ...defaultOptions,
            headers,
          };
          response = await fetch(url, retryOptions);
        }
      } else {
        // If already refreshing, wait for the refresh to complete
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((token: string) => {
            headers['Authorization'] = `Bearer ${token}`;
            const retryOptions: RequestInit = {
              ...defaultOptions,
              headers,
            };
            fetch(url, retryOptions)
              .then((res) => res.json().then((data) => resolve(data)))
              .catch(reject);
          });
        });
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401 || errorData?.code === 'token_not_valid' || /token not valid/i.test(errorData?.detail || '')) {
        clearTokens();
      }
      throw new Error(
        errorData.detail ||
        errorData.error ||
        `API Error: ${response.status}`
      );
    }

    return response.json();
  }

  // Dashboard endpoints
  dashboard = {
    getAttendance: (branchId?: number | null, departmentId?: number | null, dateFormat?: 'ad' | 'bs') => {
      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId.toString());
      if (departmentId) params.append('department_id', departmentId.toString());
      if (dateFormat) params.append('date_format', dateFormat);
      const queryString = params.toString();
      return this.request<DashboardData>(`/attendance/api/daily/${queryString ? `?${queryString}` : ''}`);
    },
    getLateArrivals: (branchId?: number | null, departmentId?: number | null, attendanceDate?: string | null, dateFormat?: 'ad' | 'bs') => {
      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId.toString());
      if (departmentId) params.append('department_id', departmentId.toString());
      if (attendanceDate) params.append('attendance_date', attendanceDate);
      if (dateFormat) params.append('date_format', dateFormat);
      const queryString = params.toString();
      return this.request<LateArrivalsData>(`/attendance/api/dashboard/late-arrivals/${queryString ? `?${queryString}` : ''}`);
    },
    getEarlyDepartures: (branchId?: number | null, departmentId?: number | null, attendanceDate?: string | null, dateFormat?: 'ad' | 'bs') => {
      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId.toString());
      if (departmentId) params.append('department_id', departmentId.toString());
      if (attendanceDate) params.append('attendance_date', attendanceDate);
      if (dateFormat) params.append('date_format', dateFormat);
      const queryString = params.toString();
      return this.request<EarlyDeparturesData>(`/attendance/api/dashboard/early-departures/${queryString ? `?${queryString}` : ''}`);
    },
    // Monthly attendance summary endpoints (server supports month or arbitrary date ranges)
    getMonthlySummary: (options: {
      year?: number;
      month?: number;
      startDate?: string;
      endDate?: string;
      branchId?: number | null;
      departmentId?: number | null;
      employeeId?: number | null;
      dateFormat?: 'ad' | 'bs';
    }) => {
      const params = new URLSearchParams();
      if (options.startDate) params.append('start_date', options.startDate);
      if (options.endDate) params.append('end_date', options.endDate);
      if (options.year) params.append('year', String(options.year));
      if (options.month) params.append('month', String(options.month));
      if (options.branchId) params.append('branch_id', options.branchId.toString());
      if (options.departmentId) params.append('department_id', options.departmentId.toString());
      if (options.employeeId) params.append('employee_id', options.employeeId.toString());
      if (options.dateFormat) params.append('date_format', options.dateFormat);
      const queryString = params.toString();
      return this.request<any>(`/attendance/api/reports/monthly-summary/${queryString ? `?${queryString}` : ''}`);
    },
    getMonthlySummaryDetailed: (options: {
      year?: number;
      month?: number;
      startDate?: string;
      endDate?: string;
      branchId?: number | null;
      departmentId?: number | null;
      employeeId?: number | null;
      dateFormat?: 'ad' | 'bs';
    }) => {
      const params = new URLSearchParams();
      if (options.startDate) params.append('start_date', options.startDate);
      if (options.endDate) params.append('end_date', options.endDate);
      if (options.year) params.append('year', String(options.year));
      if (options.month) params.append('month', String(options.month));
      if (options.branchId) params.append('branch_id', options.branchId.toString());
      if (options.departmentId) params.append('department_id', options.departmentId.toString());
      if (options.employeeId) params.append('employee_id', options.employeeId.toString());
      if (options.dateFormat) params.append('date_format', options.dateFormat);
      const queryString = params.toString();
      return this.request<any>(`/attendance/api/reports/monthly-summary-detailed/${queryString ? `?${queryString}` : ''}`);
    },
    getEmployeeDashboard: () =>
      this.request<any>('/attendance/api/employee-dashboard/'),
    getHierarchical: () =>
      this.request<HierarchicalDashboardData>('/attendance/api/dashboard/hierarchical/'),
    getBranch: (branchId: number) =>
      this.request<BranchDashboardData>(`/attendance/api/dashboard/branch/${branchId}/`),
    getDepartment: (departmentId: number) =>
      this.request<DepartmentDashboardData>(`/attendance/api/dashboard/department/${departmentId}/`),
  };

  // Device endpoints
  device = {
    heartbeat: () =>
      this.request('/attendance/iclock/getrequest/'),

    sendData: (data: Record<string, any>) =>
      this.request('/attendance/iclock/cdata/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Auth endpoints
  auth = {
    login: (email: string, password: string) =>
      this.request<any>('/userauth/api/login/', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, password }),
      }),

    logout: () =>
      this.request('/userauth/api/logout/', { method: 'POST' }),

    getCurrentUser: () =>
      this.request<any>('/userauth/api/info/'),
  };

  // User management endpoints
  users = {
    create: (userData: { username: string; password: string; email?: string; first_name?: string; last_name?: string }) =>
      this.request<any>('/userauth/api/users/create/', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
  };

  // Enterprise endpoints
  enterprise = {
    hierarchy: () =>
      this.request<{ enterprises: EnterpriseHierarchyItem[] }>('/enterprise/api/hierarchy/'),

    createDepartment: (data: { name: string; branch_id?: number | null; enterprise_id?: number; arrival_time?: string | null; departure_time?: string | null }) =>
      this.request<any>('/enterprise/api/departments/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateDepartment: (departmentId: number, data: Record<string, any>) =>
      this.request<any>(`/enterprise/api/departments/${departmentId}/`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteDepartment: (departmentId: number) =>
      this.request<any>(`/enterprise/api/departments/${departmentId}/`, {
        method: 'DELETE',
      }),
  };

  // Employee management endpoints
  employees = {
    list: () =>
      this.request<any>('/enterprise/api/employees/'),

    listWithFilters: (branchId?: number | null, departmentId?: number | null) => {
      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId.toString());
      if (departmentId) params.append('department_id', departmentId.toString());
      const queryString = params.toString();
      return this.request<any>(`/enterprise/api/employees/${queryString ? `?${queryString}` : ''}`);
    },

    listAllWithFilters: async (branchId?: number | null, departmentId?: number | null) => {
      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId.toString());
      if (departmentId) params.append('department_id', departmentId.toString());

      const baseQuery = params.toString();
      let page = 1;
      let totalCount = 0;
      const results: any[] = [];

      while (true) {
        const pageParams = new URLSearchParams(baseQuery);
        pageParams.append('page', String(page));
        const queryString = pageParams.toString();
        const response = await this.request<any>(`/enterprise/api/employees/${queryString ? `?${queryString}` : ''}`);

        if (page === 1 && typeof response?.count === 'number') {
          totalCount = response.count;
        }

        const pageResults = Array.isArray(response?.results) ? response.results : [];
        results.push(...pageResults);

        if (pageResults.length === 0 || !response?.next) {
          break;
        }

        page += 1;
      }

      return { count: totalCount || results.length, results };
    },

    create: (data: FormData) =>
      this.request<any>('/enterprise/api/employees/create/', {
        method: 'POST',
        body: data,
      }),

    detail: (employeeId: number) =>
      this.request<any>(`/enterprise/api/employees/${employeeId}/`),

    update: (employeeId: number, data: Record<string, any>) =>
      this.request<any>(`/enterprise/api/employees/${employeeId}/`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (employeeId: number) =>
      this.request<any>(`/enterprise/api/employees/${employeeId}/`, {
        method: 'DELETE',
      }),

    linkUser: (employeeId: number, userId: number) =>
      this.request<any>('/enterprise/api/employees/link-user/', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, user_id: userId }),
      }),

    connectDevice: (employeeId: number, deviceIdentifier: string) =>
      this.request<any>('/enterprise/api/employees/connect-device/', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, device_identifier: deviceIdentifier }),
      }),

    syncToDevice: (employeeId: number, deviceSerialNumber: string) =>
      this.request<any>('/enterprise/api/employees/sync-device/', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, device_serial_number: deviceSerialNumber }),
      }),
  };

  // Biometric device endpoints
  biometric = {
    enrollEmployee: (employeeId: number, deviceId: number, deviceUserId: string) =>
      this.request<any>('/enterprise/api/biometric/enroll/', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, device_id: deviceId, device_user_id: deviceUserId }),
      }),

    listEnrollments: () =>
      this.request<any>('/enterprise/api/biometric/enroll/'),

    listDevices: () =>
      this.request<any>('/enterprise/api/biometric/devices/'),
  };
}

export const apiClient = new ApiClient();
