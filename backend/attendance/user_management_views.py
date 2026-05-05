from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from enterprise.permissions import IsAdminRole
from enterprise.models import Employee
from userauth.serializers import UserSerializer


User = get_user_model()


class CreateUserAPIView(APIView):
    """Admin endpoint to create a new user"""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')
        name = request.data.get('name', '')
        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username already exists'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            name=name,
        )   

        return Response(
            {
                'message': 'User created successfully',
                'user': UserSerializer(user, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


# Employee management views moved to `enterprise.views`
