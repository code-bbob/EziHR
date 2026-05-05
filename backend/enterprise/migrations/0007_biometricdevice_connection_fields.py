from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('enterprise', '0006_biometricdevice_employeebiometricmapping'),
    ]

    operations = [
        migrations.AddField(
            model_name='biometricdevice',
            name='device_ip',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='device_port',
            field=models.PositiveIntegerField(default=4370),
        ),
    ]