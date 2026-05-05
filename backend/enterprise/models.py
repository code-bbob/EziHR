from django.conf import settings
from django.db import models
from django.utils import timezone
from datetime import time as _time

# Create your models here.

class Enterprise(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    licensed = models.BooleanField(default=False)
    licensed_until = models.DateField(blank=True, null=True)
    max_alowed_employees = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name
    

class Branch(models.Model):
    enterprise = models.ForeignKey(Enterprise, on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ('enterprise', 'name')

    def __str__(self) -> str:
        return f'{self.name} ({self.enterprise.name})'
    

class Department(models.Model):

    enterprise = models.ForeignKey(Enterprise, on_delete=models.CASCADE, related_name='departments')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='departments', blank=True, null=True)
    name = models.CharField(max_length=255)
    arrival_time = models.TimeField(default=_time(hour=9, minute=0))
    departure_time = models.TimeField(default=_time(hour=18, minute=0))
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['name']
        unique_together = ('enterprise', 'branch', 'name')
    
    def __str__(self) -> str:
        if self.branch:
            return f'{self.name} ({self.branch.name} - {self.enterprise.name})'
        return f'{self.name} ({self.enterprise.name})'


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
        ordering = ['serial_number']

    def __str__(self) -> str:
        return self.name or self.serial_number


class EmployeeBiometricMapping(models.Model):
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='biometric_mappings')
    device = models.ForeignKey(BiometricDevice, on_delete=models.CASCADE, related_name='employee_mappings')
    device_user_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['employee__name', 'device__serial_number']
        unique_together = ('device', 'device_user_id')
        indexes = [
            models.Index(fields=['device', 'device_user_id']),
            models.Index(fields=['employee', 'device']),
        ]

    def __str__(self) -> str:
        return f'{self.employee} -> {self.device.serial_number} ({self.device_user_id})'


class Employee(models.Model):
    employee_code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    avatar = models.ImageField(upload_to='employee_avatars/', blank=True, null=True)
    enterprise = models.ForeignKey(
        Enterprise,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='employees',
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='employees',
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='employees',
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='employee',
    )
    role = models.CharField(choices=[('admin', 'Admin'), ('employee', 'Employee')], default='employee', max_length=20)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name', 'employee_code']

    def __str__(self) -> str:
        return f'{self.name} ({self.employee_code})'


class DeviceCommand(models.Model):
    """Represents a command to be sent to a biometric device (e.g., add user)."""
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
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['device', 'status']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self) -> str:
        return f'{self.device.serial_number} - User {self.user_id} ({self.status})'
