from __future__ import annotations

from typing import Any

from enterprise.models import Employee

from .models import BiometricDevice, EmployeeBiometricMapping


class BiometricDeviceSyncError(RuntimeError):
    pass


def sync_employee_to_device(employee: Employee, device: BiometricDevice) -> EmployeeBiometricMapping:

    device_user_id = str(employee.employee_code).strip()
    if not device_user_id:
        raise BiometricDeviceSyncError('Employee does not have a valid employee code for device sync.')

    existing_mapping = (
        EmployeeBiometricMapping.objects.select_related('employee')
        .filter(device=device, device_user_id=device_user_id)
        .first()
    )
    if existing_mapping and existing_mapping.employee_id != employee.id:
        raise BiometricDeviceSyncError(
            f"Device user ID '{device_user_id}' is already assigned to another employee on this device."
        )

    try:
        mapping, _ = EmployeeBiometricMapping.objects.update_or_create(
            device=device,
            device_user_id=device_user_id,
            defaults={'employee': employee},
        )
        return mapping

    except Exception as exc:
        raise BiometricDeviceSyncError(f'Failed to sync employee to device: {exc}') from exc
    
