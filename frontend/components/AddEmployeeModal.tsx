'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient, type EnterpriseHierarchyItem } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  username: string;
  password: string;
  email: string;
  name: string;
  branch_id: string;
  department_id: string;
  device_id: string;
}

interface BiometricDeviceOption {
  id: number;
  name: string;
  serial_number: string;
  device_ip?: string;
  device_port?: number;
  is_active?: boolean;
}

export function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const [hierarchy, setHierarchy] = useState<EnterpriseHierarchyItem[]>([]);
  const [devices, setDevices] = useState<BiometricDeviceOption[]>([]);
  const [formData, setFormData] = useState<FormState>({
    username: '',
    password: '',
    email: '',
    name: '',
    branch_id: '',
    department_id: '',
    device_id: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userEnterprise = useMemo(
    () => hierarchy.length > 0 ? hierarchy[0] : null,
    [hierarchy]
  );

  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      setFetching(true);
      setError(null);
      try {
        const [hierarchyResponse, devicesResponse] = await Promise.all([
          apiClient.enterprise.hierarchy(),
          apiClient.biometric.listDevices(),
        ]);
        setHierarchy(hierarchyResponse.enterprises || []);
        setDevices(devicesResponse.devices || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load setup data');
      } finally {
        setFetching(false);
      }
    };

    loadInitialData();
  }, [isOpen]);

  const branchOptions = userEnterprise?.branches || [];
  const departmentOptions = useMemo(() => {
    if (!userEnterprise) return [];
    if (!formData.branch_id) return userEnterprise.departments;
    return userEnterprise.departments.filter((department) => {
      const branchId = department.branch?.id;
      return branchId ? String(branchId) === formData.branch_id : true;
    });
  }, [userEnterprise, formData.branch_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!userEnterprise) {
      setError('User enterprise not found');
      setLoading(false);
      return;
    }

    try {
      if (!formData.device_id) {
        throw new Error('Please choose a biometric device to sync to.');
      }

      const payload = new FormData();
      payload.append('username', formData.username);
      payload.append('password', formData.password);
      payload.append('email', formData.email);
      payload.append('name', formData.name);
      payload.append('enterprise_id', String(userEnterprise.id));
      payload.append('branch_id', formData.branch_id);
      if (formData.department_id) payload.append('department_id', formData.department_id);
      if (avatarFile) payload.append('avatar', avatarFile);

      const response = await apiClient.employees.create(payload);
      const employeeId = response?.employee?.id ?? response?.id;
      if (!employeeId) {
        throw new Error('Employee was created, but the server did not return an employee ID.');
      }

      await apiClient.employees.syncToDevice(employeeId, Number(formData.device_id));

      setFormData({
        username: '',
        password: '',
        email: '',
        name: '',
        branch_id: '',
        department_id: '',
        device_id: '',
      });
      setAvatarFile(null);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create and sync employee');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>
            Create the user account, employee profile, and sync to biometric device in one step.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="my-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!userEnterprise && fetching && (
          <div className="my-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-700">
            Loading your enterprise...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* User Account Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">User Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Username *</label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Password *</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Employee Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name *</label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Avatar</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Device Sync + Organization Assignment */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Device Sync *</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Biometric Device *</label>
                  <select
                    value={formData.device_id}
                    onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                    disabled={fetching}
                  >
                    <option value="">{fetching ? 'Loading...' : 'Select device'}</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name || device.serial_number}
                        {device.device_ip ? ` (${device.device_ip})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Employee will be synced using their auto-generated employee code.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Organization Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Enterprise</label>
                  <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
                    {userEnterprise?.name || 'Loading...'}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Branch *</label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => {
                      setFormData((current) => ({
                        ...current,
                        branch_id: e.target.value,
                        department_id: '',
                      }));
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                    disabled={!userEnterprise}
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
                  <label className="text-sm font-medium">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={!userEnterprise}
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
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || fetching || !userEnterprise || !formData.branch_id || !formData.device_id}
              className="flex-1"
            >
              {loading ? 'Creating & Syncing...' : 'Create & Sync Employee'}
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
