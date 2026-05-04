// components/AttendanceTable.tsx
'use client';

import { AttendanceRow } from '@/lib/api-client';

interface AttendanceTableProps {
  rows: AttendanceRow[];
  loading?: boolean;
  error?: Error | null;
}

export function AttendanceTable({ rows, loading, error }: AttendanceTableProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>Error loading attendance data: {error.message}</p>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <p>No attendance data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white dark:bg-zinc-900 rounded-lg shadow">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-100 dark:bg-zinc-800">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Employee Code
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Name
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              First Check-In
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Last Check-Out
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Worked (min)
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Worked (hours)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr key={row.employee.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {row.employee.employee_code}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                {row.employee.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                {row.check_in ? new Date(row.check_in).toLocaleTimeString() : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                {row.check_out ? new Date(row.check_out).toLocaleTimeString() : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                {row.worked_minutes}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                {(row.worked_minutes / 60).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
