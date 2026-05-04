'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Employee {
  id: number;
  employee_code: string;
  name: string;
  device_identifier: string;
}

interface ConnectDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectDeviceModal({ isOpen, onClose, onSuccess }: ConnectDeviceModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState({
    employee_id: '',
    device_identifier: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    setFetchingEmployees(true);
    try {
      const response = await apiClient.employees.list();
      setEmployees(response.employees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setFetchingEmployees(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiClient.employees.connectDevice(
        parseInt(formData.employee_id),
        formData.device_identifier
      );
      setFormData({ employee_id: '', device_identifier: '' });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect device');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-black dark:text-white mb-4">Connect Device to Employee</h2>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Employee *
            </label>
            <select
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-black dark:text-white"
              disabled={fetchingEmployees}
              required
            >
              <option value="">
                {fetchingEmployees ? 'Loading employees...' : 'Select an employee'}
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Device ID *
            </label>
            <input
              type="text"
              value={formData.device_identifier}
              onChange={(e) => setFormData({ ...formData, device_identifier: e.target.value })}
              placeholder="e.g., DEVICE_001"
              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-black dark:text-white"
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading || !formData.employee_id}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 rounded"
            >
              {loading ? 'Connecting...' : 'Connect Device'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-400 hover:bg-zinc-500 text-white font-medium py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
