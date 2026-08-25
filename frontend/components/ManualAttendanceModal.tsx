'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from 'lucide-react';

const EVENT_TYPES = [
  { value: 0, label: 'Check-In' },
  { value: 1, label: 'Check-Out' },
  { value: 2, label: 'Break-Out' },
  { value: 3, label: 'Break-In' },
  { value: 4, label: 'OT-In' },
  { value: 5, label: 'OT-Out' },
];

interface Employee {
  id: number;
  name: string;
  employee_code: string;
}

interface ManualAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendanceDate: string;
  onSuccess?: () => void;
}

export function ManualAttendanceModal({
  open,
  onOpenChange,
  attendanceDate,
  onSuccess,
}: ManualAttendanceModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [eventType, setEventType] = useState<number>(0);
  const [attendanceDateValue, setAttendanceDateValue] = useState(attendanceDate);
  const [eventTime, setEventTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmployeeId('');
    setEventType(0);
    setAttendanceDateValue(attendanceDate);
    setEventTime('');
    setError('');

    setLoadingEmployees(true);
    apiClient.employees
      .listAllWithFilters()
      .then((res) => {
        const list = Array.isArray(res?.results) ? res.results : [];
        setEmployees(list.map((e: any) => ({ id: e.id, name: e.name, employee_code: e.employee_code })));
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, [open]);

  const handleSubmit = async () => {
    if (!employeeId) {
      setError('Please select an employee');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiClient.attendance.manualMark({
        employee_id: employeeId as number,
        attendance_date: attendanceDateValue,
        event_type: eventType,
        event_time: event_time_undefined_or_value(),
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  function event_time_undefined_or_value(): string | undefined {
    return eventTime.trim() || undefined;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manual Attendance</DialogTitle>
          <DialogDescription>
            Mark attendance for an employee.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Employee select */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Employee</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : '')}
              disabled={loadingEmployees || submitting}
            >
              <option value="">
                {loadingEmployees ? 'Loading employees...' : 'Select employee'}
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_code})
                </option>
              ))}
            </select>
          </div>

          {/* Attendance date */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Date</label>
            <Input
              type="date"
              value={attendanceDateValue}
              onChange={(e) => setAttendanceDateValue(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Event type select */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Event Type</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={eventType}
              onChange={(e) => setEventType(Number(e.target.value))}
              disabled={submitting}
            >
              {EVENT_TYPES.map((et) => (
                <option key={et.value} value={et.value}>
                  {et.label}
                </option>
              ))}
            </select>
          </div>

          {/* Event time */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Time (optional)</label>
            <Input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              disabled={submitting}
              placeholder="Leave blank for current time"
            />
            <p className="text-xs text-muted-foreground">
              If left blank, current time will be used.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Mark Attendance'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
