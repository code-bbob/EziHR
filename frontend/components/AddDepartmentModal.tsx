'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient, type EnterpriseHierarchyItem } from '@/lib/api-client';

interface AddDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDepartmentModal({ isOpen, onClose, onSuccess }: AddDepartmentModalProps) {
  const [hierarchy, setHierarchy] = useState<EnterpriseHierarchyItem[]>([]);
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
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
        setError(err instanceof Error ? err.message : 'Failed to load enterprises');
      } finally {
        setFetching(false);
      }
    };

    loadHierarchy();
  }, [isOpen]);

  // User's enterprise is the first one in hierarchy (their own)
  const userEnterprise = hierarchy.length > 0 ? hierarchy[0] : null;
  const branchOptions = userEnterprise?.branches || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiClient.enterprise.createDepartment({
        name,
        branch_id: branchId ? Number(branchId) : null,
      });
      setName('');
      setBranchId('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Add Department</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {userEnterprise
                ? `Create departments for: ${userEnterprise.name}`
                : 'Loading enterprise information...'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            ✕
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

        {!fetching && !userEnterprise && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-700">
            You are not associated with any enterprise. Contact your administrator.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Department Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              required
              disabled={!userEnterprise || fetching}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Branch (Optional)</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              disabled={!userEnterprise || fetching}
            >
              <option value="">No branch</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !userEnterprise || fetching}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? 'Creating Department...' : 'Create Department'}
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
