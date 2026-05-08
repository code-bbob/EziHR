from django.db import models

from enterprise.models import Branch, Enterprise, Employee


class BiometricDevice(models.Model):
    enterprise = models.ForeignKey(
        Enterprise,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='biometric_devices',
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='biometric_devices',
    )
    name = models.CharField(max_length=255, blank=True, default='')
    serial_number = models.CharField(max_length=64, unique=True)
    location = models.CharField(max_length=255, blank=True, default='')
    device_ip = models.CharField(max_length=255, blank=True, default='')
    device_port = models.PositiveIntegerField(default=4370)
    device_model = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'device_biometricdevice'
        ordering = ['serial_number']

    def __str__(self) -> str:
        return self.name or self.serial_number


class EmployeeBiometricMapping(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='biometric_mappings')
    device = models.ForeignKey(BiometricDevice, on_delete=models.CASCADE, related_name='employee_mappings')
    device_user_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'device_employeebiometricmapping'
        ordering = ['employee__name', 'device__serial_number']
        unique_together = ('device', 'device_user_id')
        indexes = [
            models.Index(fields=['device', 'device_user_id']),
            models.Index(fields=['employee', 'device']),
        ]

    def __str__(self) -> str:
        return f'{self.employee} -> {self.device.serial_number} ({self.device_user_id})'


class DeviceCommand(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('done', 'Done'),
        ('failed', 'Failed'),
    ]

    device = models.ForeignKey(
        BiometricDevice,
        on_delete=models.CASCADE,
        related_name='commands',
    )
    user_id = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'device_devicecommand'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['device', 'status']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self) -> str:
        return f'{self.device.serial_number} - User {self.user_id} ({self.status})'
