'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient, type EnterpriseHierarchyItem } from '@/lib/api-client';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  username: string;
  password: string;
  email: string;
  employee_code: string;
  name: string;
  device_identifier: string;
  enterprise_id: string;
  branch_id: string;
  department_id: string;
}

export function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const [hierarchy, setHierarchy] = useState<EnterpriseHierarchyItem[]>([]);
  const [formData, setFormData] = useState<FormState>({
    username: '',
    password: '',
    email: '',
    employee_code: '',
    name: '',
    device_identifier: '',
    enterprise_id: '',
    branch_id: '',
    department_id: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadHierarchy = async () => {
      setFetching(true);
      setError(null);
      try {
        const response = await apiClient.enterprise.hierarchy();
        setHierarchy(response.enterprises || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load enterprise hierarchy');
      } finally {
        setFetching(false);
      }
    };

    loadHierarchy();
  }, [isOpen]);

  const selectedEnterprise = useMemo(
    () => hierarchy.find((enterprise) => String(enterprise.id) === formData.enterprise_id) || null,
    [hierarchy, formData.enterprise_id]
  );

  const branchOptions = selectedEnterprise?.branches || [];
  const departmentOptions = useMemo(() => {
    if (!selectedEnterprise) return [];
    if (!formData.branch_id) return selectedEnterprise.departments;
    return selectedEnterprise.departments.filter((department) => {
      const branchId = department.branch?.id;
      return branchId ? String(branchId) === formData.branch_id : true;
    });
  }, [selectedEnterprise, formData.branch_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = new FormData();
      payload.append('username', formData.username);
      payload.append('password', formData.password);
      payload.append('email', formData.email);
      payload.append('employee_code', formData.employee_code);
      payload.append('name', formData.name);
      payload.append('device_identifier', formData.device_identifier);
      payload.append('enterprise_id', formData.enterprise_id);
      payload.append('branch_id', formData.branch_id);
      if (formData.department_id) payload.append('department_id', formData.department_id);
      if (avatarFile) payload.append('avatar', avatarFile);

      await apiClient.employees.create(payload);

      setFormData({
        username: '',
        password: '',
        email: '',
        employee_code: '',
        name: '',
        device_identifier: '',
        enterprise_id: '',
        branch_id: '',
        department_id: '',
      });
      setAvatarFile(null);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Add Employee</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Create the user account, employee profile, and organization mapping together.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-white">User Account</h3>
            {[
              ['username', 'Username *', 'text'],
              ['password', 'Password *', 'password'],
              ['email', 'Email', 'email'],
            ].map(([key, label, type]) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
                <input
                  type={type}
                  value={formData[key as keyof FormState]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  required={label.includes('*')}
                />
              </div>
            ))}
          </section>

          <section className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Employee Profile</h3>
            {[
              ['employee_code', 'Employee Code *', 'text'],
              ['name', 'Full Name *', 'text'],
              ['device_identifier', 'Device ID', 'text'],
            ].map(([key, label, type]) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
                <input
                  type={type}
                  value={formData[key as keyof FormState]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  required={label.includes('*')}
                />
              </div>
            ))}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Avatar</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-zinc-200 p-4 lg:col-span-2 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Organization Assignment</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Enterprise *</label>
                <select
                  value={formData.enterprise_id}
                  onChange={(e) => {
                    setFormData((current) => ({
                      ...current,
                      enterprise_id: e.target.value,
                      branch_id: '',
                      department_id: '',
                    }));
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  required
                  disabled={fetching}
                >
                  <option value="">{fetching ? 'Loading enterprises...' : 'Select enterprise'}</option>
                  {hierarchy.map((enterprise) => (
                    <option key={enterprise.id} value={enterprise.id}>
                      {enterprise.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Branch *</label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => {
                    setFormData((current) => ({
                      ...current,
                      branch_id: e.target.value,
                      department_id: '',
                    }));
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  required
                  disabled={!selectedEnterprise}
                >
                  <option value="">Select branch</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  disabled={!selectedEnterprise}
                >
                  <option value="">All departments</option>
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                      {department.branch?.name ? ` (${department.branch.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <div className="lg:col-span-2 flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !formData.enterprise_id || !formData.branch_id}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? 'Creating Employee...' : 'Create Employee'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-zinc-200 px-6 py-3 font-medium text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
