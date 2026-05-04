from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .models import Branch, Department, Employee, Enterprise

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
