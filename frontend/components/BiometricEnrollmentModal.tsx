'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Employee {
  id: number;
  employee_code: string;
  name: string;
}

interface BiometricDevice {
  id: number;
  serial_number: string;
  name: string;
  enterprise?: number;
  branch?: number;
  is_active: boolean;
}

interface BiometricEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BiometricEnrollmentModal({ isOpen, onClose, onSuccess }: BiometricEnrollmentModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [formData, setFormData] = useState({
    employee_id: '',
    device_id: '',
    device_user_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const [empResponse, devResponse] = await Promise.all([
        apiClient.employees.list(),
        apiClient.biometric.listDevices(),
      ]);
      setEmployees(empResponse.results || empResponse.employees || []);
      setDevices(devResponse.results || devResponse.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.device_id || !formData.device_user_id) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.biometric.enrollEmployee(
        parseInt(formData.employee_id),
        parseInt(formData.device_id),
        formData.device_user_id
      );
      setFormData({ employee_id: '', device_id: '', device_user_id: '' });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll employee');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Enroll Employee to Device</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Map a device user ID to an employee for biometric authentication.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Employee *</label>
            <select
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              disabled={fetching}
              required
            >
              <option value="">{fetching ? 'Loading...' : 'Select employee'}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Biometric Device *</label>
            <select
              value={formData.device_id}
              onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              disabled={fetching}
              required
            >
              <option value="">{fetching ? 'Loading...' : 'Select device'}</option>
              {devices.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name || dev.serial_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Device User ID *
            </label>
            <input
              type="text"
              value={formData.device_user_id}
              onChange={(e) => setFormData({ ...formData, device_user_id: e.target.value })}
              placeholder="e.g., 1, EMP123, or fingerprint ID"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              required
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              The ID this employee uses on the device (may be 1, EMP123, badge number, etc.)
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading || fetching}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? 'Enrolling...' : 'Enroll'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
