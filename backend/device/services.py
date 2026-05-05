from __future__ import annotations

from typing import Any

from enterprise.models import Employee

from .models import BiometricDevice, EmployeeBiometricMapping


class BiometricDeviceSyncError(RuntimeError):
    pass


def _get_zk_client():
    from zk import ZK

    return ZK


def sync_employee_to_device(employee: Employee, device: BiometricDevice) -> EmployeeBiometricMapping:
    device_ip = (device.device_ip or '').strip()
    if not device_ip:
        raise BiometricDeviceSyncError('Selected biometric device does not have an IP address configured.')

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

    zk_class = _get_zk_client()
    zk = zk_class(device_ip, port=int(device.device_port or 4370), timeout=5)
    conn = None

    try:
        conn = zk.connect()
        conn.disable_device()

        users = conn.get_users() or []
        for user in users:
            if str(getattr(user, 'user_id', '')).strip() == device_user_id:
                mapping, _ = EmployeeBiometricMapping.objects.update_or_create(
                    device=device,
                    device_user_id=device_user_id,
                    defaults={'employee': employee},
                )
                return mapping

        existing_uids = {
            getattr(user, 'uid', None)
            for user in users
            if getattr(user, 'uid', None) is not None
        }
        next_uid = 1
        while next_uid in existing_uids:
            next_uid += 1

        conn.set_user(
            uid=next_uid,
            name=employee.name,
            privilege=0,
            password='',
            user_id=device_user_id,
        )

        mapping, _ = EmployeeBiometricMapping.objects.update_or_create(
            device=device,
            device_user_id=device_user_id,
            defaults={'employee': employee},
        )
        return mapping
    except BiometricDeviceSyncError:
        raise
    except Exception as exc:
        raise BiometricDeviceSyncError(f'Failed to sync employee to device: {exc}') from exc
    finally:
        if conn is not None:
            try:
                conn.enable_device()
            except Exception:
                pass
            try:
                conn.disconnect()
            except Exception:
                pass
