from rest_framework import serializers
from django.contrib.auth import get_user_model
from enterprise.serializers import BranchSummarySerializer, DepartmentSummarySerializer, EnterpriseSummarySerializer
from django.utils.encoding import smart_str, force_bytes, DjangoUnicodeDecodeError
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from .utils import Util

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
  employee_profile = serializers.SerializerMethodField()

  class Meta:
    model = User
    fields=['id', 'username', 'email', 'name', 'is_staff', 'employee_profile']
    read_only_fields = ['id']

  def get_employee_profile(self, user):
    employee = getattr(user, 'employee', None)
    if not employee:
      return None

    request = self.context.get('request')
    avatar_url = None
    if employee.avatar:
      avatar_url = employee.avatar.url
      if request is not None:
        avatar_url = request.build_absolute_uri(avatar_url)

    return {
      'id': employee.id,
      'employee_code': employee.employee_code,
      'name': employee.name,
      'enterprise': EnterpriseSummarySerializer(employee.enterprise).data if employee.enterprise else None,
      'branch': BranchSummarySerializer(employee.branch).data if employee.branch else None,
      'department': DepartmentSummarySerializer(employee.department).data if employee.department else None,
      'avatar': avatar_url,
    }

class UserRegistrationSerializer(serializers.ModelSerializer):
  # We are writing this becoz we need confirm password field in our Registratin Request
  password2 = serializers.CharField(style={'input_type':'password'}, write_only=True)
  class Meta:
    model = User
    fields=['username', 'email', 'name', 'password', 'password2']
    extra_kwargs={
      'password':{'write_only':True}
    }

  # Validating Password and Confirm Password while Registration
  def validate(self, attrs):
    password = attrs.get('password')
    password2 = attrs.get('password2')
    if password != password2:
      raise serializers.ValidationError("Password and Confirm Password doesn't match")
    return attrs

  def create(self, validate_data):
    validate_data.pop('password2', None)
    return User.objects.create_user(**validate_data)

class UserLoginSerializer(serializers.ModelSerializer):
  email = serializers.EmailField(max_length=255)
  class Meta:
    model = User
    fields = ['email', 'password']
  
class UserChangePasswordSerializer(serializers.Serializer):
  password = serializers.CharField(max_length=255, style={'input_type':'password'}, write_only=True)
  password2 = serializers.CharField(max_length=255, style={'input_type':'password'}, write_only=True)
  class Meta:
    fields = ['password', 'password2']

  def validate(self, attrs):
    password = attrs.get('password')
    password2 = attrs.get('password2')
    user = self.context.get('user')
    if password != password2:
      raise serializers.ValidationError("Password and Confirm Password doesn't match")
    user.set_password(password)
    user.save()
    return attrs
  

class SendPasswordResetEmailSerializer(serializers.Serializer):
  email = serializers.EmailField(max_length=255)
  class Meta:
    fields = ['email']

  def validate(self, attrs):
    email = attrs.get('email')
    if User.objects.filter(email=email).exists():
      user = User.objects.get(email = email)
      uid = urlsafe_base64_encode(force_bytes(user.id))
      token = PasswordResetTokenGenerator().make_token(user)
      link = 'http://localhost:8000/userauth/api/reset-password/'+uid+'/'+token+'/'
      # Send EMail
      body = 'Click Following Link to Reset Your Password '+link
      data = {
        'subject':'Reset Your Password',
        'body':body,
        'to_email':user.email
      } 
      Util.send_email(data)
      return attrs
    else:
      raise serializers.ValidationError('You are not a Registered User')

class UserPasswordResetSerializer(serializers.Serializer):
  password = serializers.CharField(max_length=255, style={'input_type':'password'}, write_only=True)
  password2 = serializers.CharField(max_length=255, style={'input_type':'password'}, write_only=True)
  class Meta:
    fields = ['password', 'password2']

  def validate(self, attrs):
    try:
      password = attrs.get('password')
      password2 = attrs.get('password2')
      uid = self.context.get('uid')
      token = self.context.get('token')
      if password != password2:
        raise serializers.ValidationError("Password and Confirm Password doesn't match")
      id = smart_str(urlsafe_base64_decode(uid))
      user = User.objects.get(id=id)
      if not PasswordResetTokenGenerator().check_token(user, token):
        raise serializers.ValidationError('Token is not Valid or Expired')
      user.set_password(password)
      user.save()
      return attrs
    except DjangoUnicodeDecodeError as identifier:
      PasswordResetTokenGenerator().check_token(user, token)
      raise serializers.ValidationError('Token is not Valid or Expire d')
    
  

class UserInfoSerializer(serializers.ModelSerializer):
 
  enterprise = serializers.IntegerField(source='employee.enterprise.id', read_only=True)
  branch = serializers.IntegerField(source='employee.branch.id', read_only=True)
  department = serializers.IntegerField(source='employee.department.id', read_only=True)
  enterprise_name = serializers.CharField(source='employee.enterprise.name', read_only=True)
  branch_name = serializers.CharField(source='employee.branch.name', read_only=True)
  department_name = serializers.CharField(source='employee.department.name', read_only=True)
  class Meta:
    model = User
    fields = ['id', 'username', 'email', 'name', 'is_staff', 'enterprise', 'branch', 'department', 'enterprise_name', 'branch_name', 'department_name']