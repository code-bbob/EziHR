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


class Employee(models.Model):
    employee_code = models.CharField(max_length=64,blank=True)
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
        constraints = [
            models.UniqueConstraint(
                fields=['enterprise', 'employee_code'],
                name='unique_employee_code_per_enterprise',
            )
        ]

    def __str__(self) -> str:
        return f'{self.name} ({self.employee_code})'
