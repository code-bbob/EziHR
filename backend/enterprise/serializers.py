from django.db import transaction
from rest_framework import serializers
from datetime import time as _time

from .models import Branch, Department, Enterprise
from .models import Employee
from device.models import BiometricDevice, EmployeeBiometricMapping, DeviceCommand


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name', 'address', 'contact_email', 'contact_phone', 'created_at']


class DepartmentSerializer(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'name', 'branch', 'created_at']


class EnterpriseHierarchySerializer(serializers.ModelSerializer):
    branches = BranchSerializer(many=True, read_only=True)
    departments = DepartmentSerializer(many=True, read_only=True)

    class Meta:
        model = Enterprise
        fields = ['id', 'name', 'address', 'contact_email', 'contact_phone', 'licensed', 'licensed_until', 'max_alowed_employees', 'branches', 'departments']


class EnterpriseSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Enterprise
        fields = ['id', 'name']


class BranchSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name']


class DepartmentSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name']


class EmployeeAvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = ['id', 'employee_code', 'name', 'avatar']


class BiometricDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BiometricDevice
        fields = [
            'id', 'name', 'serial_number', 'device_ip', 'device_port', 'device_model', 'enterprise', 'branch',
            'is_active', 'last_seen_at', 'created_at',
        ]


class EmployeeBiometricMappingSerializer(serializers.ModelSerializer):
    device = BiometricDeviceSerializer(read_only=True)

    class Meta:
        model = EmployeeBiometricMapping
        fields = ['id', 'employee', 'device', 'device_user_id', 'created_at']


class BiometricEnrollmentSerializer(serializers.Serializer):
    """Enroll an employee into a biometric device with a device-specific user ID."""
    employee_id = serializers.IntegerField(required=True)
    device_id = serializers.IntegerField(required=True)
    device_user_id = serializers.CharField(max_length=64, required=True)

    def validate(self, attrs):
        employee_id = attrs.get('employee_id')
        device_id = attrs.get('device_id')
        
        employee = Employee.objects.filter(id=employee_id).first()
        if not employee:
            raise serializers.ValidationError({'employee_id': 'Employee not found.'})

        device = BiometricDevice.objects.filter(id=device_id).first()
        if not device:
            raise serializers.ValidationError({'device_id': 'Biometric device not found.'})

        attrs['employee'] = employee
        attrs['device'] = device
        return attrs

    def create(self, validated_data):
        employee = validated_data.pop('employee')
        device = validated_data.pop('device')
        device_user_id = validated_data.pop('device_user_id')

        mapping, created = EmployeeBiometricMapping.objects.update_or_create(
            device=device,
            device_user_id=device_user_id,
            defaults={'employee': employee},
        )
        return mapping


class EmployeeSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    enterprise = EnterpriseSummarySerializer(read_only=True)
    branch = BranchSummarySerializer(read_only=True)
    department = DepartmentSummarySerializer(read_only=True)

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_code', 'name', 'avatar', 'email', 'address', 'phone', 'dob',
            'enterprise', 'branch', 'department', 'user', 'arrival_time', 'departure_time', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_user(self, employee):
        if not employee.user:
            return None
        from userauth.serializers import UserSerializer

        request = self.context.get('request')
        return UserSerializer(employee.user, context={'request': request}).data


class EmployeeCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
    dob = serializers.DateField(required=False, allow_null=True)
    arrival_time = serializers.TimeField(required=False, allow_null=True)
    departure_time = serializers.TimeField(required=False, allow_null=True)
    employee_code = serializers.CharField(max_length=64, required=False, allow_blank=True)
    name = serializers.CharField(max_length=255)
    avatar = serializers.ImageField(required=False, allow_null=True)
    enterprise_id = serializers.IntegerField(required=True)
    branch_id = serializers.IntegerField(required=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        request = self.context.get('request')
        user_enterprise_id = None
        if request is not None:
            user = request.user
            if hasattr(user, 'employee') and user.employee and user.employee.enterprise_id:
                user_enterprise_id = user.employee.enterprise_id
            elif hasattr(user, 'profile') and user.profile and user.profile.enterprise_id:
                user_enterprise_id = user.profile.enterprise_id

        enterprise_id = attrs.get('enterprise_id')
        branch_id = attrs.get('branch_id')
        department_id = attrs.get('department_id')

        if user_enterprise_id and enterprise_id != user_enterprise_id:
            raise serializers.ValidationError({'enterprise_id': 'You can only create employees in your own enterprise.'})

        enterprise = Enterprise.objects.filter(id=enterprise_id).first() if enterprise_id else None
        branch = Branch.objects.filter(id=branch_id).first() if branch_id else None
        department = Department.objects.filter(id=department_id).first() if department_id else None

        if enterprise is None:
            raise serializers.ValidationError({'enterprise_id': 'Enterprise not found.'})

        if branch is None:
            raise serializers.ValidationError({'branch_id': 'Branch not found.'})

        if branch.enterprise_id != enterprise.id:
            raise serializers.ValidationError({'branch_id': 'Branch does not belong to the selected enterprise.'})

        if department_id:
            if department is None:
                raise serializers.ValidationError({'department_id': 'Department not found.'})
            if department.enterprise_id != enterprise.id:
                raise serializers.ValidationError({'department_id': 'Department does not belong to the selected enterprise.'})
            if department.branch_id and department.branch_id != branch.id:
                raise serializers.ValidationError({'department_id': 'Department does not belong to the selected branch.'})

        attrs['enterprise'] = enterprise
        attrs['branch'] = branch
        attrs['department'] = department
        return attrs

    def create(self, validated_data):
        from uuid import uuid4

        enterprise = validated_data.pop('enterprise')
        branch = validated_data.pop('branch')
        department = validated_data.pop('department', None)
        provided_employee_code = validated_data.pop('employee_code', '').strip()
        name = validated_data.pop('name')
        email = validated_data.pop('email', '')
        address = validated_data.pop('address', '')
        phone = validated_data.pop('phone', '')
        dob = validated_data.pop('dob', None)
        arrival_time = validated_data.pop('arrival_time', None)
        departure_time = validated_data.pop('departure_time', None)
        avatar = validated_data.pop('avatar', None)
        is_active = validated_data.pop('is_active', True)

        with transaction.atomic():
            if provided_employee_code:
                exists = Employee.objects.filter(
                    enterprise=enterprise,
                    employee_code=provided_employee_code,
                ).exists()
                if exists:
                    raise serializers.ValidationError(
                        {'employee_code': 'Employee code already exists in this enterprise.'}
                    )
                next_employee_code = provided_employee_code
            else:
                existing_codes = (
                    Employee.objects.select_for_update()
                    .filter(enterprise=enterprise)
                    .values_list('employee_code', flat=True)
                )
                max_numeric_code = 0
                for code in existing_codes:
                    if code and str(code).isdigit():
                        max_numeric_code = max(max_numeric_code, int(code))
                next_employee_code = str(max_numeric_code + 1)

            employee = Employee.objects.create(
                enterprise=enterprise,
                branch=branch,
                department=department,
                arrival_time=arrival_time if arrival_time else _time(hour=9, minute=0),
                departure_time=departure_time if departure_time else _time(hour=18, minute=0),
                name=name,
                employee_code=next_employee_code or f'TEMP-{uuid4().hex[:10].upper()}',
                avatar=avatar,
                email=email,
                address=address,
                phone=phone,
                dob=dob,
                is_active=is_active,
            )

        return employee


class DeviceCommandSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceCommand
        fields = ['id', 'device', 'user_id', 'name', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CreateDeviceCommandSerializer(serializers.Serializer):
    """Serializer for creating a new device command from frontend."""
    device_serial_number = serializers.CharField(max_length=64, required=True)
    user_id = serializers.CharField(max_length=64, required=True)
    name = serializers.CharField(max_length=255, required=True)

    def validate(self, attrs):
        device_serial_number = attrs.get('device_serial_number')
        device = BiometricDevice.objects.filter(serial_number=device_serial_number).first()
        if not device:
            raise serializers.ValidationError({'device_serial_number': 'Device not found.'})
        attrs['device'] = device
        return attrs

    def create(self, validated_data):
        device = validated_data.pop('device')
        command = DeviceCommand.objects.create(
            device=device,
            user_id=validated_data['user_id'],
            name=validated_data['name'],
            status='pending',
        )
        return command
