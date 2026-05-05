from django.db import models
from django.conf import settings
import uuid
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser, PermissionsMixin
# Create your models here.

class UserManager(BaseUserManager):
    def create_user(self, email, name, password=None, username=None,  **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')

        normalized_email = self.normalize_email(email)
        resolved_username = username or normalized_email.split('@')[0]
        if self.model.objects.filter(username=resolved_username).exists():
            resolved_username = f'{resolved_username}_{uuid.uuid4().hex[:6]}'

        resolved_name = name

        user = self.model(
            email=normalized_email,
            username=resolved_username,
            name=resolved_name,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, username=None, name='Admin', **extra_fields):
        user = self.create_user(
            email=email,
            password=password,
            username=username,
            name=name,
            **extra_fields,
        )
        user.is_superuser = True
        user.is_staff = True
        user.save(using=self._db)
        return user
    
class User(AbstractBaseUser,PermissionsMixin):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(
        verbose_name="email address",
        max_length=255,
        unique=True,
    )
    name = models.CharField(max_length=150)
    id = models.UUIDField(primary_key=True,default = uuid.uuid4, unique=True)  
    is_active = models.BooleanField(default=True)
    is_superuser = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False)

      # Include groups if needed
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name='userauth_users',
        related_query_name='userauth_user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name='userauth_users',
        related_query_name='userauth_user',
    )

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'name']

    def __str__(self):
        return self.email


class Otp(models.Model):
    otp = models.CharField(max_length=6)
    email = models.EmailField()

    def __str__(self):
        return (f"{self.email} : {self.otp}")


class UserProfile(models.Model):
    """Extended user profile to associate users with enterprise and branch."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    enterprise = models.ForeignKey(
        'enterprise.Enterprise',
        on_delete=models.CASCADE,
        related_name='users',
    )
    branch = models.ForeignKey(
        'enterprise.Branch',
        on_delete=models.CASCADE,
        related_name='users',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'enterprise', 'branch')

    def __str__(self) -> str:
        return f'{self.user.name or self.user.username} ({self.enterprise.name} - {self.branch.name})'
