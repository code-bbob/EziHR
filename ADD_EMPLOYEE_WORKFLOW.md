
# Add Employee -> Create Device Command Workflow

This document captures the full "Add Employee" workflow (frontend + backend) used in this codebase so you can copy-paste the snippets into another project for a one-shot implementation via Copilot.

**Overview**
- Frontend: `AddEmployeeModal` collects profile data and selected biometric device, calls the backend to create the employee, then requests a device sync using the device serial number.
- Backend: employee creation endpoint, a device sync endpoint that creates a pending `DeviceCommand`, and device endpoints that poll for pending commands and mark them done.

**Quick choices**
- Use two-step flow (create employee -> sync-to-device) or one-step (`create-and-sync`) endpoint that does both atomically.

**Frontend: key pieces**
- Form submits multipart `FormData` to create an employee, then calls sync API with employee id and device serial number.

Example (core logic taken from `AddEmployeeModal`):

```tsx
// submit handler (React)
const payload = new FormData();
payload.append('name', formData.name);
payload.append('enterprise_id', String(userEnterprise.id));
payload.append('branch_id', formData.branch_id);
// ... other fields, optional avatar file
const response = await apiClient.employees.create(payload);
const employeeId = response?.employee?.id ?? response?.id;
// then request device sync using serial number
await apiClient.employees.syncToDevice(employeeId, selectedDevice.serial_number);
```

Alternative: call the combined endpoint that accepts `device_serial_number` on create.

```ts
// call create-and-sync
const formData = new FormData();
// append fields including device_serial_number
formData.append('device_serial_number', selectedDevice.serial_number);
await apiClient.request('/enterprise/api/employees/create-and-sync/', { method: 'POST', body: formData });
```

**Frontend API client (endpoints)**
- Used endpoints (from `lib/api-client.ts`):

```ts
this.request('/enterprise/api/employees/create/', { method: 'POST', body: data });
this.request('/enterprise/api/employees/sync-device/', { method: 'POST', body: JSON.stringify({ employee_id, device_serial_number }) });
this.request('/enterprise/api/employees/create-and-sync/', { method: 'POST', body: data });
// device polling endpoints: GET /device/adms_getrequest (device polls), POST /device/adms_devicecmd (device posts result)
```

**Backend: data models**
- `device.models.DeviceCommand` (pending commands are polled and executed by device):

```py
class DeviceCommand(models.Model):
    device = models.ForeignKey(BiometricDevice, on_delete=models.CASCADE, related_name='commands')
    user_id = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

- `device.models.EmployeeBiometricMapping` maps `employee <-> device` and stores the device-specific user id.

**Backend: sync service**
- `device.services.sync_employee_to_device(employee, device)` ensures mapping and returns the mapping object. It validates/wraps device_user_id and prevents duplicates.

```py
def sync_employee_to_device(employee, device):
    device_user_id = str(employee.employee_code).strip()
    mapping, _ = EmployeeBiometricMapping.objects.update_or_create(
        device=device,
        device_user_id=device_user_id,
        defaults={'employee': employee},
    )
    return mapping
```

**Backend: API views (what to implement)**

- Create Employee (atomic, returns employee):

```py
class CreateEmployeeAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        serializer = EmployeeCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        return Response({'employee': EmployeeSerializer(employee).data}, status=201)
```

- Sync employee to device (creates pending DeviceCommand):

```py
class EmployeeDeviceSyncAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        employee_id = request.data.get('employee_id')
        device_serial_number = request.data.get('device_serial_number')
        employee = Employee.objects.filter(id=employee_id, enterprise=enterprise).first()
        device = BiometricDevice.objects.filter(serial_number=device_serial_number).first()
        mapping = sync_employee_to_device(employee, device)
        command, created = DeviceCommand.objects.get_or_create(
            device=device,
            user_id=str(mapping.device_user_id),
            status='pending',
            defaults={'name': employee.name},
        )
        return Response({'command': DeviceCommandSerializer(command).data}, status=201)
```

- Create-and-sync (single request): create employee then create DeviceCommand (same checks as above) in a single transaction.

**Backend: device polling endpoints (what device calls)**
- Device periodically GETs the polling endpoint to fetch pending command. Example simplified implementation:

```py
def adms_getrequest(request):
    serial_number = request.GET.get('SN')
    device = BiometricDevice.objects.get(serial_number=serial_number)
    command = DeviceCommand.objects.filter(device=device, status='pending').first()
    if command:
        # format expected by device: C:{id}:DATA UPDATE USERINFO PIN={user_id}\tName={name}\t...
        response = f'C:{command.id}:DATA UPDATE USERINFO PIN={command.user_id}\tName={command.name}\tPri=0\tPasswd=\tCard=\t'
        return HttpResponse(response, content_type='text/plain')
    return HttpResponse('OK', content_type='text/plain')

def adms_devicecmd(request):
    # device posts result; backend should mark command as done
    command_id = parse_from_body(request.body)
    command = DeviceCommand.objects.filter(id=command_id, device=device).first()
    if command:
        command.status = 'done'
        command.save(update_fields=['status'])
    return HttpResponse('OK')
```

**URLs to add**
- Mount the enterprise and device APIs so the frontend paths match. Example mappings used in this project:

```py
# backend/enterprise/urls.py
path('api/employees/create/', CreateEmployeeAPIView.as_view()),
path('api/employees/create-and-sync/', CreateEmployeeAndSyncAPIView.as_view()),
path('api/employees/sync-device/', EmployeeDeviceSyncAPIView.as_view()),
# device polling endpoints (exposed for device network):
path('adms/getrequest/', adms_getrequest),
path('adms/devicecmd/', adms_devicecmd),
```

**Testing / curl examples**
- Create employee then sync (two-step):

```bash
curl -X POST -F "name=Alice" -F "enterprise_id=1" -F "branch_id=2" http://localhost:8000/enterprise/api/employees/create/
# server returns { employee: { id: 42, employee_code: 'E042', ... } }
curl -X POST -H "Content-Type: application/json" -d '{"employee_id":42,"device_serial_number":"SN123"}' http://localhost:8000/device/api/employees/sync-device/
```

- Create-and-sync (one-step):

```bash
curl -X POST -F "name=Alice" -F "enterprise_id=1" -F "branch_id=2" -F "device_serial_number=SN123" http://localhost:8000/enterprise/api/employees/create-and-sync/
```

**Notes & gotchas**
- Device user id is derived from `employee.employee_code`. Ensure employee codes are generated before sync.
- The backend creates a `DeviceCommand` with status `pending`. The device polling endpoint returns a device-specific command string and the device marks it done by calling the `devicecmd` endpoint.
- Access controls: ensure only admins can create/sync employees.
- If your other project uses a different device protocol, replace the `adms_getrequest`/`adms_devicecmd` format, but keep the `DeviceCommand` pending/done lifecycle.

**Copy-paste checklist for Copilot**
1. Add `DeviceCommand` and `EmployeeBiometricMapping` models.
2. Add `sync_employee_to_device` service to manage mappings.
3. Add employee create, create-and-sync, and sync-device APIViews (with permission checks and enterprise scoping).
4. Add device polling endpoints that return pending commands and mark them done.
5. Implement frontend modal that: creates employee then calls sync endpoint (or calls create-and-sync). Use FormData for avatar upload.

---
File created from analysis of this workspace's implementation.
