from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN, HTTP_404_NOT_FOUND
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django.db import transaction, models

from .models import Branch, Department, Enterprise, Employee
from .serializers import (
	BranchSerializer,
	DepartmentSerializer,
	EnterpriseHierarchySerializer,
	EmployeeCreateSerializer,
	EmployeeSerializer,
)
from device.models import BiometricDevice, EmployeeBiometricMapping, DeviceCommand
from device.serializers import (
    BiometricEnrollmentSerializer,
    EmployeeBiometricMappingSerializer,
    BiometricDeviceSerializer,
    DeviceCommandSerializer,
    CreateDeviceCommandSerializer,
)
from datetime import datetime
from django.contrib.auth import get_user_model
from rest_framework import status
from userauth.serializers import UserSerializer

User = get_user_model()


class DefaultPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = None
    max_page_size = 30


def _resolve_user_enterprise(user):
    if hasattr(user, 'employee') and user.employee and user.employee.enterprise:
        return user.employee.enterprise
    if hasattr(user, 'profile') and user.profile and user.profile.enterprise:
        return user.profile.enterprise
    return None


class EnterpriseHierarchyAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        enterprises = Enterprise.objects.filter(id=enterprise.id).prefetch_related('branches', 'departments')
        serializer = EnterpriseHierarchySerializer(enterprises, many=True)
        return Response({'enterprises': serializer.data})


class DepartmentCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        name = request.data.get('name')
        branch_id = request.data.get('branch_id')
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        branch = None
        if branch_id:
            branch = Branch.objects.filter(id=branch_id, enterprise=enterprise).first()
            if branch is None:
                return Response({'error': 'Branch not found for your enterprise'}, status=HTTP_404_NOT_FOUND)

        department = Department.objects.create(enterprise=enterprise, branch=branch, name=name)
        return Response({'message': 'Department created successfully', 'department': DepartmentSerializer(department).data}, status=HTTP_201_CREATED)

class CreateEmployeeAPIView(APIView):
    """Admin endpoint to create a user and employee at the same time"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    @transaction.atomic
    def post(self, request):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        serializer = EmployeeCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        return Response(
            {
                'message': 'Employee created successfully',
                'employee': EmployeeSerializer(employee, context={'request': request}).data,
                'user': UserSerializer(employee.user, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ListEmployeesAPIView(APIView):
    """Admin endpoint to list all employees"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        branch_id = request.query_params.get('branch_id')
        department_id = request.query_params.get('department_id')

        employees = Employee.objects.filter(enterprise=enterprise)
        if branch_id:
            employees = employees.filter(branch_id=branch_id)
        if department_id:
            employees = employees.filter(department_id=department_id)

        employees = employees.select_related('enterprise', 'branch', 'department', 'user').order_by('name', 'employee_code')

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(employees, request, view=self)
        serializer = EmployeeSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class EmployeeDetailAPIView(APIView):
    """Admin endpoint to view and update employee details"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, employee_id):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        try:
            employee = Employee.objects.select_related('enterprise', 'branch', 'department', 'user').get(
                id=employee_id,
                enterprise=enterprise,
            )
        except Employee.DoesNotExist:
            return Response(
                {'error': 'Employee not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = EmployeeSerializer(employee, context={'request': request})
        return Response(serializer.data)

    def put(self, request, employee_id):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        try:
            employee = Employee.objects.select_related('enterprise', 'branch', 'department', 'user').get(
                id=employee_id,
                enterprise=enterprise,
            )
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        user_employee = getattr(user, 'employee', None)
        if not user.is_superuser and getattr(user_employee, 'role', None) != 'admin':
            return Response({'error': 'You can only update employees for your enterprise'}, status=HTTP_403_FORBIDDEN)

        name = request.data.get('name')
        employee_code = request.data.get('employee_code')
        branch_id = request.data.get('branch_id')
        department_id = request.data.get('department_id')
        is_active = request.data.get('is_active')

        branch = employee.branch
        department = employee.department

        if name is not None:
            employee.name = name
            if employee.user:
                employee.user.name = name
                employee.user.save(update_fields=['name'])

        if employee_code is not None:
            employee.employee_code = employee_code

        if branch_id is not None:
            if branch_id in ('', None, False):
                branch = None
                department = None
            else:
                branch = Branch.objects.filter(id=branch_id, enterprise=enterprise).first()
                if branch is None:
                    return Response({'error': 'Branch not found for your enterprise'}, status=HTTP_404_NOT_FOUND)

        if department_id is not None:
            if department_id in ('', None, False):
                department = None
            else:
                department = Department.objects.filter(id=department_id, enterprise=enterprise).first()
                if department is None:
                    return Response({'error': 'Department not found for your enterprise'}, status=HTTP_404_NOT_FOUND)

        if branch is not None and department is not None and department.branch_id and department.branch_id != branch.id:
            return Response({'error': 'Department does not belong to the selected branch'}, status=HTTP_400_BAD_REQUEST)

        if is_active is not None:
            if isinstance(is_active, str):
                employee.is_active = is_active.lower() in ('1', 'true', 'yes', 'on')
            else:
                employee.is_active = bool(is_active)

        employee.branch = branch
        employee.department = department
        employee.save()

        serializer = EmployeeSerializer(employee, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, employee_id):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        try:
            employee = Employee.objects.get(id=employee_id, enterprise=enterprise)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND)

        # Optionally delete linked user account as part of removing employee entirely
        if employee.user:
            try:
                employee.user.delete()
            except Exception:
                # ignore user deletion errors but continue with employee deletion
                pass

        employee.delete()
        return Response({'message': 'Employee deleted successfully'}, status=status.HTTP_200_OK)


class DepartmentDetailAPIView(APIView):
    """Admin endpoint to view, update, or delete a department (including setting working hours)"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, department_id):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        try:
            department = Department.objects.get(id=department_id, enterprise=enterprise)
        except Department.DoesNotExist:
            return Response({'error': 'Department not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DepartmentSerializer(department)
        return Response(serializer.data)

    def put(self, request, department_id):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        try:
            department = Department.objects.get(id=department_id, enterprise=enterprise)
        except Department.DoesNotExist:
            return Response({'error': 'Department not found'}, status=status.HTTP_404_NOT_FOUND)

        # Only allow admins of enterprise or superuser
        user = request.user
        if not user.is_superuser and user.employee.role != 'admin':
            return Response({'error': 'You can only update departments for your enterprise'}, status=HTTP_403_FORBIDDEN)

        name = request.data.get('name')
        branch_id = request.data.get('branch_id')
        arrival_time = request.data.get('arrival_time')
        departure_time = request.data.get('departure_time')

        if name is not None:
            department.name = name

        if branch_id is not None:
            if branch_id in ('', None, False):
                department.branch = None
            else:
                branch = Branch.objects.filter(id=branch_id, enterprise=department.enterprise).first()
                if branch is None:
                    return Response({'error': 'Branch not found for the department enterprise'}, status=HTTP_404_NOT_FOUND)
                department.branch = branch

        # Parse and set working hours if provided (expect 'HH:MM' strings)
        if arrival_time:
            try:
                department.arrival_time = datetime.strptime(arrival_time, '%H:%M').time()
            except Exception:
                return Response({'error': 'Invalid arrival_time format. Expected HH:MM'}, status=HTTP_400_BAD_REQUEST)

        if departure_time:
            try:
                department.departure_time = datetime.strptime(departure_time, '%H:%M').time()
            except Exception:
                return Response({'error': 'Invalid departure_time format. Expected HH:MM'}, status=HTTP_400_BAD_REQUEST)

        department.save()
        serializer = DepartmentSerializer(department)
        return Response(serializer.data)

    def delete(self, request, department_id):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        try:
            department = Department.objects.get(id=department_id, enterprise=enterprise)
        except Department.DoesNotExist:
            return Response({'error': 'Department not found'}, status=HTTP_404_NOT_FOUND)

        # permission check
        user = request.user
        if not user.is_superuser and user.employee.role != 'admin':
            return Response({'error': 'You can only delete departments for your enterprise'}, status=HTTP_403_FORBIDDEN)

        department.delete()
        return Response({'message': 'Department deleted successfully'}, status=status.HTTP_200_OK)


class BiometricEnrollmentAPIView(APIView):
    """Admin endpoint to enroll an employee into a biometric device with a device-specific user ID."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        serializer = BiometricEnrollmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

        employee = serializer.validated_data['employee']
        device = serializer.validated_data['device']

        if employee.enterprise_id != enterprise.id:
            return Response(
                {'error': 'Employee does not belong to your enterprise'},
                status=HTTP_403_FORBIDDEN,
            )

        if device.enterprise_id and device.enterprise_id != enterprise.id:
            return Response(
                {'error': 'Device does not belong to your enterprise'},
                status=HTTP_403_FORBIDDEN,
            )

        mapping = serializer.save()
        return Response(
            {
                'message': 'Employee enrolled successfully',
                'mapping': EmployeeBiometricMappingSerializer(mapping, context={'request': request}).data,
            },
            status=HTTP_201_CREATED,
        )

    def get(self, request):
        """List all biometric enrollments for the enterprise."""
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        mappings = EmployeeBiometricMapping.objects.select_related(
            'employee', 'device'
        ).filter(
            employee__enterprise=enterprise,
        ).order_by('employee__name', 'device__serial_number')

        serializer = EmployeeBiometricMappingSerializer(mappings, many=True, context={'request': request})
        return Response({'mappings': serializer.data})


class BiometricDeviceListAPIView(APIView):
    """Admin endpoint to list biometric devices for the enterprise."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        # List devices that are either mapped to this enterprise or have no enterprise yet
        devices = BiometricDevice.objects.filter(
            models.Q(enterprise=enterprise) | models.Q(enterprise__isnull=True)
        ).order_by('serial_number')

        serializer = BiometricDeviceSerializer(devices, many=True)
        return Response({'devices': serializer.data})


class EmployeeDeviceSyncAPIView(APIView):
    """Create a sync command for an employee to a device. Device polls and executes on next poll."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        employee_id = request.data.get('employee_id')
        device_serial_number = request.data.get('device_serial_number')
        if not employee_id or not device_serial_number:
            return Response(
                {'error': 'employee_id and device_serial_number are required'},
                status=HTTP_400_BAD_REQUEST,
            )

        employee = Employee.objects.select_related('enterprise').filter(id=employee_id, enterprise=enterprise).first()
        if employee is None:
            return Response({'error': 'Employee not found'}, status=HTTP_404_NOT_FOUND)

        device = BiometricDevice.objects.filter(serial_number=device_serial_number).first()
        if device is None:
            return Response({'error': 'Biometric device not found'}, status=HTTP_404_NOT_FOUND)

        if device.enterprise_id and device.enterprise_id != enterprise.id:
            return Response({'error': 'Device does not belong to your enterprise'}, status=HTTP_403_FORBIDDEN)

        if not device.is_active:
            return Response({'error': 'Selected biometric device is inactive'}, status=HTTP_400_BAD_REQUEST)

        # Create pending command instead of immediate sync
        command = DeviceCommand.objects.create(
            device=device,
            user_id=employee.employee_code,
            name=employee.name,
            status='pending',
        )

        return Response(
            {
                'message': 'Sync command created. Device will execute on next poll.',
                'command': DeviceCommandSerializer(command, context={'request': request}).data,
            },
            status=HTTP_201_CREATED,
        )


class CreateEmployeeAndSyncAPIView(APIView):
    """Create an employee (with user account) and immediately create a device command for enrollment."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    @transaction.atomic
    def post(self, request):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        # Step 1: Create the employee + user
        serializer = EmployeeCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        
        employee = serializer.save()

        # Step 2: Create device command for enrollment
        device_serial_number = request.data.get('device_serial_number')
        if not device_serial_number:
            return Response(
                {'error': 'device_serial_number is required for device sync'},
                status=HTTP_400_BAD_REQUEST,
            )

        device = BiometricDevice.objects.filter(serial_number=device_serial_number).first()
        if device is None:
            return Response({'error': 'Biometric device not found'}, status=HTTP_404_NOT_FOUND)

        if device.enterprise_id and device.enterprise_id != enterprise.id:
            return Response({'error': 'Device does not belong to your enterprise'}, status=HTTP_403_FORBIDDEN)

        if not device.is_active:
            return Response({'error': 'Selected biometric device is inactive'}, status=HTTP_400_BAD_REQUEST)

        # Create pending command for device to execute on next poll
        command = DeviceCommand.objects.create(
            device=device,
            user_id=employee.employee_code,
            name=employee.name,
            status='pending',
        )

        return Response(
            {
                'message': 'Employee created successfully. Device sync command created and pending.',
                'employee': EmployeeSerializer(employee, context={'request': request}).data,
                'user': UserSerializer(employee.user, context={'request': request}).data,
                'device_command': DeviceCommandSerializer(command, context={'request': request}).data,
            },
            status=HTTP_201_CREATED,
        )


class LinkUserToEmployeeAPIView(APIView):
    """Admin endpoint to link a user to an employee"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        enterprise = _resolve_user_enterprise(request.user)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        employee_id = request.data.get('employee_id')

        if not user_id or not employee_id:
            return Response(
                {'error': 'user_id and employee_id are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            employee = Employee.objects.get(id=employee_id, enterprise=enterprise)
        except Employee.DoesNotExist:
            return Response(
                {'error': 'Employee not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if employee already has a user
        if employee.user and employee.user.id != user_id:
            return Response(
                {'error': 'Employee is already linked to another user'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if user is already linked to an employee
        if Employee.objects.filter(user=user, enterprise=enterprise).exclude(id=employee_id).exists():
            return Response(
                {'error': 'User is already linked to another employee'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee.user = user
        employee.save()

        serializer = EmployeeSerializer(employee, context={'request': request})
        return Response(
            {
                'message': 'User linked to employee successfully',
                'employee': serializer.data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================================
# ZKTeco ADMS Protocol Endpoints (Device-to-Server communication)
# ============================================================================

from django.http import HttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone



