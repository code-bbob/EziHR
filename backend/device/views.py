from __future__ import annotations

from datetime import timedelta

from django.http import HttpRequest, HttpResponse
from django.db import models
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import UnsupportedMediaType
from rest_framework.parsers import BaseParser, FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN, HTTP_404_NOT_FOUND
from rest_framework.views import APIView
from enterprise.permissions import IsAdminRole

from attendance.services import (
    infer_next_event_code,
    parse_device_timestamp,
    parse_event_code,
    record_device_event,
    register_biometric_device,
    resolve_employee,
)
from enterprise.models import Employee

from .models import BiometricDevice, DeviceCommand, EmployeeBiometricMapping
from .serializers import (
    BiometricDeviceSerializer,
    BiometricEnrollmentSerializer,
    CreateDeviceCommandSerializer,
    DeviceCommandSerializer,
    EmployeeBiometricMappingSerializer,
)
from .services import sync_employee_to_device

TIME_SYNC_INTERVAL = timedelta(seconds=1)


class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return


class PlainTextParser(BaseParser):
    media_type = 'text/plain'

    def parse(self, stream, media_type=None, parser_context=None):
        return stream.read().decode('utf-8')


def _plain_text_response(message: str) -> HttpResponse:
    return HttpResponse(message, content_type='text/plain; charset=utf-8')


def _pick_value(payload: dict, keys: list[str], default=None):
    for key in keys:
        if key in payload and payload[key] not in (None, ''):
            return payload[key]
    return default


def _parse_iclock_row_format(raw_str: str) -> dict:
    row = raw_str.strip()
    if not row:
        return {}

    parts = row.split('\t')
    data: dict[str, object] = {'raw': row}
    if len(parts) >= 1:
        data['PIN'] = parts[0].strip()
    if len(parts) >= 2:
        data['timestamp'] = parts[1].strip()
    if len(parts) >= 3:
        data['event_code'] = parts[2].strip()
    if len(parts) >= 4:
        data['status'] = parts[3].strip()
    if len(parts) >= 5:
        data['attendance_status'] = parts[4].strip()
    return data


def _parse_iclock_rows(raw_body: str) -> list[dict]:
    rows: list[dict] = []
    for line in raw_body.splitlines():
        clean_line = line.strip()
        if not clean_line:
            continue
        parsed = _parse_iclock_row_format(clean_line)
        if parsed:
            rows.append(parsed)
    return rows


def _parse_request_data(request: HttpRequest) -> dict:
    data: dict[str, object] = {}
    data.update(request.GET.dict())
    data.update(request.POST.dict())

    raw_request = getattr(request, '_request', request)
    raw_body = getattr(raw_request, 'body', b'')
    if isinstance(raw_body, bytes):
        raw_body = raw_body.decode('utf-8', errors='ignore')
    raw_body = str(raw_body).strip()

    if raw_body:
        if '=' in raw_body and '\t' not in raw_body:
            for chunk in raw_body.split('&'):
                if '=' not in chunk:
                    continue
                key, value = chunk.split('=', 1)
                data[key.strip()] = value.strip()
        else:
            iclock_rows = _parse_iclock_rows(raw_body)
            if iclock_rows:
                data['rows'] = iclock_rows
                data.update(iclock_rows[-1])
            else:
                data['raw'] = raw_body
    return data


@csrf_exempt
@require_http_methods(["GET", "POST"])
def adms_cdata(request):
    serial_number = request.GET.get('SN', '').strip()
    if not serial_number:
        return HttpResponse('ERROR', status=400)

    if request.method == 'GET':
        try:
            device = BiometricDevice.objects.get(serial_number=serial_number)
            device.last_seen_at = timezone.now()
            device.save(update_fields=['last_seen_at'])
        except BiometricDevice.DoesNotExist:
            BiometricDevice.objects.create(
                serial_number=serial_number,
                is_active=True,
                last_seen_at=timezone.now(),
            )
        return HttpResponse(f'GET OPTION FROM: {serial_number}', content_type='text/plain')

    raw_body = request.body.decode('utf-8', errors='ignore').strip()
    try:
        payload = request.POST.dict() if request.POST else _parse_request_data(request)
    except UnsupportedMediaType:
        payload = _parse_request_data(request)

    if not isinstance(payload, dict):
        payload = _parse_request_data(request)

    if raw_body and isinstance(payload, dict) and 'rows' not in payload and 'raw' not in payload:
        parsed_rows = _parse_iclock_rows(raw_body)
        if parsed_rows:
            payload['rows'] = parsed_rows
            payload.update(parsed_rows[-1])
        else:
            payload['raw'] = raw_body

    base_payload = dict(payload) if isinstance(payload, dict) else {}
    base_payload.update(request.GET.dict())
    rows = base_payload.pop('rows', None)
    if isinstance(rows, list) and rows:
        records = [{**base_payload, **row} for row in rows if isinstance(row, dict)]
    else:
        records = [base_payload]

    for record_payload in records:
        sn = _pick_value(record_payload, ['SN', 'sn', 'device_sn', 'DeviceSN'], 'unknown')
        employee_identifier = _pick_value(
            record_payload,
            ['PIN', 'pin', 'UserID', 'userid', 'USERID', 'EMPID', 'empid', 'employee_id', 'device_id', 'CardNo', 'cardno', 'ID', 'id'],
        )
        event_code = parse_event_code(
            _pick_value(record_payload, ['event_code', 'event', 'type', 'eventtype', 'eventType', 'attendance_type', 'status'])
        )
        event_time = parse_device_timestamp(
            _pick_value(record_payload, ['timestamp', 'time', 'datetime', 'date_time', 'punch_time', 'punchTime'])
        )

        if sn:
            register_biometric_device(sn, last_seen_at=event_time)

        employee = resolve_employee(employee_identifier, device_serial=sn)
        if employee is None:
            continue

        if event_code is None:
            event_code = infer_next_event_code(employee, event_time)

        if sn:
            device = register_biometric_device(
                sn,
                enterprise=getattr(employee, 'enterprise', None),
                branch=getattr(employee, 'branch', None),
                last_seen_at=event_time,
            )
            if device is not None and device.enterprise_id is None and employee.enterprise_id is not None:
                device.enterprise = employee.enterprise
                device.branch = employee.branch
                device.save(update_fields=['enterprise', 'branch'])

        record_device_event(
            employee=employee,
            event_type=event_code,
            event_time=event_time,
            device_serial=str(sn),
            raw_payload=record_payload,
        )

    return _plain_text_response('OK')


@csrf_exempt
@require_http_methods(["GET", "POST"])
def adms_getrequest(request):
    serial_number = request.GET.get('SN', '').strip()
    if not serial_number:
        return HttpResponse('ERROR', status=400)

    try:
        device = BiometricDevice.objects.get(serial_number=serial_number)
    except BiometricDevice.DoesNotExist:
        return HttpResponse('ERROR', status=400)

    now = timezone.now()
    command = DeviceCommand.objects.filter(device=device, status='pending').first()
    if command:
        response = f'C:{command.id}:DATA UPDATE USERINFO PIN={command.user_id}\tName={command.name}\tPri=0\tPasswd=\tCard=\t'
        return HttpResponse(response, content_type='text/plain')

    # Keep device clock close to server time without flooding commands.
    if (
        device.last_time_sync_at is None
        or (now - device.last_time_sync_at) >= TIME_SYNC_INTERVAL
    ):
        timestamp = timezone.localtime(now).strftime('%Y-%m-%d %H:%M:%S')
        command_id = int(now.timestamp())
        response = f'C:{command_id}:SET OPTION DATETIME={timestamp}'
        print("Sending response: ", response)
        device.last_time_sync_at = now
        device.last_seen_at = now
        device.save(update_fields=['last_time_sync_at', 'last_seen_at'])
        return HttpResponse(response, content_type='text/plain')

    device.last_seen_at = now
    device.save(update_fields=['last_seen_at'])
    return HttpResponse('OK', content_type='text/plain')


@csrf_exempt
@require_http_methods(["POST"])
def adms_devicecmd(request):
    serial_number = request.GET.get('SN', '').strip()
    if not serial_number:
        return HttpResponse('ERROR', status=400)

    try:
        device = BiometricDevice.objects.get(serial_number=serial_number)
    except BiometricDevice.DoesNotExist:
        return HttpResponse('ERROR', status=400)

    body = request.body.decode('utf-8', errors='ignore').strip()
    command_id = None
    if body:
        parts = body.split(':')
        if len(parts) >= 2 and parts[0] == 'C':
            try:
                command_id = int(parts[1])
            except (ValueError, IndexError):
                command_id = None

    command = None
    if command_id is not None:
        command = DeviceCommand.objects.filter(id=command_id, device=device).first()

    if command is None:
        command = DeviceCommand.objects.filter(device=device, status='pending').order_by('created_at', 'id').first()

    if command is not None:
        command.status = 'done'
        command.save(update_fields=['status'])

    return HttpResponse('OK', content_type='text/plain')


@csrf_exempt
@require_http_methods(["GET", "POST"])
def device_ping(request):
    return _plain_text_response('OK')


class IClockCDataView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [PlainTextParser, FormParser, MultiPartParser, JSONParser]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request: HttpRequest, *args, **kwargs):
        return adms_cdata(request)

    def post(self, request: HttpRequest, *args, **kwargs):
        return adms_cdata(request)


class IClockGetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get(self, request: HttpRequest, *args, **kwargs):
        return adms_getrequest(request)

    def post(self, request: HttpRequest, *args, **kwargs):
        return adms_getrequest(request)


class IClockDeviceCmdView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def post(self, request: HttpRequest, *args, **kwargs):
        return adms_devicecmd(request)


class BiometricEnrollmentAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        enterprise = getattr(getattr(request.user, 'employee', None), 'enterprise', None)
        if enterprise is None:
            profile = getattr(request.user, 'profile', None)
            enterprise = getattr(profile, 'enterprise', None)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        serializer = BiometricEnrollmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

        employee = serializer.validated_data['employee']
        device = serializer.validated_data['device']

        if employee.enterprise_id != enterprise.id:
            return Response({'error': 'Employee does not belong to your enterprise'}, status=HTTP_403_FORBIDDEN)

        if device.enterprise_id and device.enterprise_id != enterprise.id:
            return Response({'error': 'Device does not belong to your enterprise'}, status=HTTP_403_FORBIDDEN)

        mapping = serializer.save()
        return Response({'message': 'Employee enrolled successfully', 'mapping': EmployeeBiometricMappingSerializer(mapping, context={'request': request}).data}, status=HTTP_201_CREATED)

    def get(self, request):
        enterprise = getattr(getattr(request.user, 'employee', None), 'enterprise', None)
        if enterprise is None:
            profile = getattr(request.user, 'profile', None)
            enterprise = getattr(profile, 'enterprise', None)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        mappings = EmployeeBiometricMapping.objects.select_related('employee', 'device').filter(employee__enterprise=enterprise).order_by('employee__name', 'device__serial_number')
        serializer = EmployeeBiometricMappingSerializer(mappings, many=True, context={'request': request})
        return Response({'mappings': serializer.data})


class BiometricDeviceListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        enterprise = getattr(getattr(request.user, 'employee', None), 'enterprise', None)
        if enterprise is None:
            profile = getattr(request.user, 'profile', None)
            enterprise = getattr(profile, 'enterprise', None)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        devices = BiometricDevice.objects.filter(models.Q(enterprise=enterprise) | models.Q(enterprise__isnull=True)).order_by('serial_number')
        serializer = BiometricDeviceSerializer(devices, many=True)
        return Response({'devices': serializer.data})


class EmployeeDeviceSyncAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        enterprise = getattr(getattr(request.user, 'employee', None), 'enterprise', None)
        if enterprise is None:
            profile = getattr(request.user, 'profile', None)
            enterprise = getattr(profile, 'enterprise', None)
        if enterprise is None:
            return Response({'error': 'No enterprise is mapped to this user'}, status=HTTP_403_FORBIDDEN)

        employee_id = request.data.get('employee_id')
        device_serial_number = request.data.get('device_serial_number')
        if not employee_id or not device_serial_number:
            return Response({'error': 'employee_id and device_serial_number are required'}, status=HTTP_400_BAD_REQUEST)

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

        mapping = sync_employee_to_device(employee, device)
        device_user_id = str(employee.employee_code).strip()

        command, created = DeviceCommand.objects.get_or_create(
            device=device,
            user_id=str(mapping.device_user_id),
            status='pending',
            defaults={'name': employee.name},
        )
        if not created and command.name != employee.name:
            command.name = employee.name
            command.save(update_fields=['name', 'updated_at'])

        return Response(
            {
                'message': 'Sync command created. Device will execute on next poll.',
                'mapping': EmployeeBiometricMappingSerializer(mapping, context={'request': request}).data,
                'command': DeviceCommandSerializer(command).data,
            },
            status=HTTP_201_CREATED,
        )


class CreateDeviceCommandAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateDeviceCommandSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            command = serializer.save()
            return Response(DeviceCommandSerializer(command).data, status=HTTP_201_CREATED)
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


class ListDevicesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        devices = BiometricDevice.objects.all().order_by('-last_seen_at')
        serializer = BiometricDeviceSerializer(devices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
