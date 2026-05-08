from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('device', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='biometricdevice',
            name='last_time_sync_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
