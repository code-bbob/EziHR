from rest_framework import serializers

from enterprise.models import Employee

from .models import BiometricDevice, EmployeeBiometricMapping, DeviceCommand


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

        mapping, _ = EmployeeBiometricMapping.objects.update_or_create(
            device=device,
            device_user_id=device_user_id,
            defaults={'employee': employee},
        )
        return mapping


class DeviceCommandSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceCommand
        fields = ['id', 'device', 'user_id', 'name', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CreateDeviceCommandSerializer(serializers.Serializer):
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
