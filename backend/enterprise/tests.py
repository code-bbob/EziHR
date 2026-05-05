from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from unittest.mock import patch

from .models import Branch, Department, Employee, Enterprise, BiometricDevice, EmployeeBiometricMapping

User = get_user_model()


class EmployeeDetailAPITests(TestCase):
	def setUp(self):
		self.enterprise = Enterprise.objects.create(name='Acme HR')
		self.branch_a = Branch.objects.create(enterprise=self.enterprise, name='Head Office')
		self.branch_b = Branch.objects.create(enterprise=self.enterprise, name='Remote Office')
		self.department_a = Department.objects.create(enterprise=self.enterprise, branch=self.branch_a, name='Operations')
		self.department_b = Department.objects.create(enterprise=self.enterprise, branch=self.branch_b, name='Support')

		self.user = User.objects.create_user(
			username='admin',
			email='admin@example.com',
			password='password123',
			name='Admin User',
			is_staff=True,
		)
		self.employee = Employee.objects.create(
			user=self.user,
			enterprise=self.enterprise,
			branch=self.branch_a,
			department=self.department_a,
			employee_code='EMP001',
			name='Admin User',
			role='admin',
			is_active=True,
		)

		self.client = APIClient()
		self.client.force_authenticate(user=self.user)

	def test_update_employee_profile(self):
		response = self.client.put(
			f'/enterprise/api/employees/{self.employee.id}/',
			{
				'name': 'Updated Name',
				'employee_code': 'EMP099',
				'branch_id': self.branch_b.id,
				'department_id': self.department_b.id,
				'is_active': False,
			},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.employee.refresh_from_db()
		self.user.refresh_from_db()

		self.assertEqual(self.employee.name, 'Updated Name')
		self.assertEqual(self.employee.employee_code, 'EMP099')
		self.assertEqual(self.employee.branch_id, self.branch_b.id)
		self.assertEqual(self.employee.department_id, self.department_b.id)
		self.assertFalse(self.employee.is_active)
		self.assertEqual(self.user.name, 'Updated Name')

	def test_rejects_mismatched_department_branch(self):
		response = self.client.put(
			f'/enterprise/api/employees/{self.employee.id}/',
			{
				'branch_id': self.branch_b.id,
				'department_id': self.department_a.id,
			},
			format='json',
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn('Department does not belong to the selected branch', str(response.data))


class EmployeeCreateAndSyncAPITests(TestCase):
	def setUp(self):
		self.enterprise = Enterprise.objects.create(name='Acme HR')
		self.branch = Branch.objects.create(enterprise=self.enterprise, name='Head Office')
		self.user = User.objects.create_user(
			username='admin',
			email='admin@example.com',
			password='password123',
			name='Admin User',
			is_staff=True,
		)
		self.employee = Employee.objects.create(
			user=self.user,
			enterprise=self.enterprise,
			branch=self.branch,
			employee_code='EMP001',
			name='Admin User',
			role='admin',
			is_active=True,
		)
		self.device = BiometricDevice.objects.create(
			enterprise=self.enterprise,
			branch=self.branch,
			name='Front Door',
			serial_number='DEVICE-01',
			device_ip='192.168.1.201',
			device_port=4370,
		)
		self.client = APIClient()
		self.client.force_authenticate(user=self.user)

	def test_create_employee_generates_employee_code(self):
		response = self.client.post(
			'/enterprise/api/employees/create/',
			{
				'username': 'newhire',
				'password': 'password123',
				'email': 'newhire@example.com',
				'name': 'New Hire',
				'enterprise_id': self.enterprise.id,
				'branch_id': self.branch.id,
			},
			format='multipart',
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.data['employee']['employee_code'], str(response.data['employee']['id']))

	def test_sync_employee_to_device(self):
		mapping = EmployeeBiometricMapping.objects.create(
			employee=self.employee,
			device=self.device,
			device_user_id=self.employee.employee_code,
		)

		with patch('enterprise.views.sync_employee_to_device', return_value=mapping) as sync_mock:
			response = self.client.post(
				'/enterprise/api/employees/sync-device/',
				{
					'employee_id': self.employee.id,
					'device_id': self.device.id,
				},
				format='json',
			)

		self.assertEqual(response.status_code, 201)
		sync_mock.assert_called_once()
		self.assertEqual(response.data['mapping']['device_user_id'], self.employee.employee_code)
