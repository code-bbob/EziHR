'use client';

import React, { useEffect, useState } from 'react';
import { apiClient, type EnterpriseHierarchyItem } from '@/lib/api-client';
import { AddDepartmentModal } from '@/components/AddDepartmentModal';
import { AddEmployeeModal } from '@/components/AddEmployeeModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function SettingsPage() {
  const [hierarchy, setHierarchy] = useState<EnterpriseHierarchyItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [deptForm, setDeptForm] = useState<Record<string, any>>({});
  const [syncingEmployeeId, setSyncingEmployeeId] = useState<number | null>(null);
  const [deviceSelections, setDeviceSelections] = useState<Record<number, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await apiClient.enterprise.hierarchy();
      setHierarchy(h.enterprises || []);
      const e = await apiClient.employees.list();
      setEmployees(e.results || e.employees || []);
      const d = await apiClient.biometric.listDevices();
      setDevices(d.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const userEnterprise = hierarchy.length > 0 ? hierarchy[0] : null;

  const handleDeptEdit = (department: any) => {
    setEditingDeptId(department.id);
    setDeptForm({
      name: department.name,
      branch_id: department.branch?.id || '',
      arrival_time: department.arrival_time || '',
      departure_time: department.departure_time || '',
    });
  };

  const handleDeptSave = async (departmentId: number) => {
    try {
      await apiClient.enterprise.updateDepartment(departmentId, {
        name: deptForm.name,
        branch_id: deptForm.branch_id || null,
        arrival_time: deptForm.arrival_time,
        departure_time: deptForm.departure_time,
      });
      setEditingDeptId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeptDelete = async (departmentId: number) => {
    if (!confirm('Delete this department? This cannot be undone.')) return;
    try {
      await apiClient.enterprise.deleteDepartment(departmentId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEmployeeAssign = async (employeeId: number, updates: Record<string, any>) => {
    try {
      await apiClient.employees.update(employeeId, updates);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEmployeeDelete = async (employeeId: number) => {
    if (!confirm('Delete this employee and linked user account?')) return;
    try {
      await apiClient.employees.delete(employeeId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSyncEmployee = async (employeeId: number) => {
    const deviceId = deviceSelections[employeeId];
    if (!deviceId) {
      setError('Please select a device to sync to');
      return;
    }
    setSyncingEmployeeId(employeeId);
    try {
      // Find the device's serial number from the selected device ID
      const selectedDevice = devices.find(d => String(d.id) === String(deviceId));
      if (!selectedDevice) {
        throw new Error('Selected device not found');
      }
      await apiClient.employees.syncToDevice(employeeId, selectedDevice.serial_number);
      setDeviceSelections((prev) => {
        const updated = { ...prev };
        delete updated[employeeId];
        return updated;
      });
      setSyncingEmployeeId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync employee');
      setSyncingEmployeeId(null);
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddDept(true)} variant="outline">Add Department</Button>
          <Button onClick={() => setShowAddEmp(true)}>Add Employee</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Departments</h2>
        {loading && (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">Loading departments...</div>
        )}
        {!loading && (!userEnterprise || (userEnterprise.departments || []).length === 0) && (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">No departments found.</div>
        )}

        <div className="space-y-3">
          {(userEnterprise?.departments || []).map((dept) => (
            <Card key={dept.id} className="border-border/60">
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-base truncate">
                    {dept.name}
                    {dept.branch?.name ? ` — ${dept.branch.name}` : ''}
                  </div>
                  {editingDeptId === dept.id ? (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <input
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={deptForm.name}
                        onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                        placeholder="Department name"
                      />
                      <input
                        type="time"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={deptForm.arrival_time || ''}
                        onChange={(e) => setDeptForm({ ...deptForm, arrival_time: e.target.value })}
                      />
                      <input
                        type="time"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={deptForm.departure_time || ''}
                        onChange={(e) => setDeptForm({ ...deptForm, departure_time: e.target.value })}
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={deptForm.branch_id || ''}
                        onChange={(e) => setDeptForm({ ...deptForm, branch_id: e.target.value })}
                      >
                        <option value="">No branch</option>
                        {(userEnterprise?.branches || []).map((branch) => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1">
                      Arrival: {(dept as any).arrival_time || '09:00'} — Departure: {(dept as any).departure_time || '18:00'}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  {editingDeptId === dept.id ? (
                    <>
                      <Button size="sm" onClick={() => handleDeptSave(dept.id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingDeptId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleDeptEdit(dept)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeptDelete(dept.id)}>Delete</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Employees</h2>
        <div className="space-y-3">
          {employees.map((emp) => (
            <Card key={emp.id} className="border-border/60">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-base truncate">{emp.name} — {emp.employee_code}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Branch: {emp.branch?.name || '—'} — Department: {emp.department?.name || '—'}
                    </div>
                  </div>

                  <Button size="sm" variant="destructive" onClick={() => handleEmployeeDelete(emp.id)}>Delete</Button>
                </div>

                {/* Organization Assignment Row */}
                <div className="flex gap-2 items-center">
                  <select
                    defaultValue={emp.branch?.id || ''}
                    onChange={(e) => handleEmployeeAssign(emp.id, { branch_id: e.target.value || null })}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
                  >
                    <option value="">No branch</option>
                    {(userEnterprise?.branches || []).map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>

                  <select
                    defaultValue={emp.department?.id || ''}
                    onChange={(e) => handleEmployeeAssign(emp.id, { department_id: e.target.value || null })}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[260px]"
                  >
                    <option value="">No department</option>
                    {(userEnterprise?.departments || []).map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}{department.branch?.name ? ` (${department.branch.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Device Sync Row */}
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium">Sync to device:</span>
                  <select
                    value={deviceSelections[emp.id] || ''}
                    onChange={(e) => setDeviceSelections((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm flex-1"
                  >
                    <option value="">Select device</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name || device.serial_number}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSyncEmployee(emp.id)}
                    disabled={syncingEmployeeId === emp.id || !deviceSelections[emp.id]}
                  >
                    {syncingEmployeeId === emp.id ? 'Syncing...' : 'Sync'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <AddDepartmentModal isOpen={showAddDept} onClose={() => setShowAddDept(false)} onSuccess={() => { setShowAddDept(false); loadData(); }} />
      <AddEmployeeModal isOpen={showAddEmp} onClose={() => setShowAddEmp(false)} onSuccess={() => { setShowAddEmp(false); loadData(); }} />
    </div>
  );
}
