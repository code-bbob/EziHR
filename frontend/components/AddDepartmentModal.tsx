'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient, type EnterpriseHierarchyItem } from '@/lib/api-client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      console.log(err);
      setError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Department</DialogTitle>
          <DialogDescription>
            {userEnterprise
              ? `Create departments for: ${userEnterprise.name}`
              : 'Loading enterprise information...'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!fetching && !userEnterprise && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-700">
            You are not associated with any enterprise. Contact your administrator.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Department Name *</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={!userEnterprise || fetching}
                  placeholder="Enter department name"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Branch (Optional)</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
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
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading || !userEnterprise || fetching}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Department'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
