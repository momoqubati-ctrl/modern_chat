# نسخة احتياطية لقاعدة البيانات (NewChat Database Backup)

تحتوي هذه الحزمة على نسخة احتياطية كاملة (Schema & Data) لقاعدة بيانات المشروع المعتمدة على **PostgreSQL 18**.

## تفاصيل النسخة
- **اسم قاعدة البيانات:** `newchat`
- **محرك قاعدة البيانات:** PostgreSQL 18
- **الترميز (Encoding):** `UTF-8` (دعم كامل ومطلق للنصوص العربية)
- **إجمالي الجداول:** 58 جدولاً (تشمل كافة جداول النظام الأساسية، الرومات، الرتب، المحافظ ودفاتر العملات، إعدادات وشرائح الهدايا، محفظة الاستضافة، سجلات التكرار Idempotency، ونظام الفيد والمنشورات بالكامل)
- **خيارات التصدير المستخدمة:** `--clean --if-exists --no-owner --no-privileges --encoding=UTF8`

---

## طريقة استعادة النسخة الاحتياطية (Restore)

### 1. عبر PowerShell (Windows):
```powershell
$env:PGPASSWORD = "postgres"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -U postgres -d newchat -f backups\database\newchat_backup.sql
```

### 2. عبر الطرفية العامة (Bash / Linux / Mac):
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d newchat -f backups/database/newchat_backup.sql
```

---

## طريقة أخذ نسخة احتياطية جديدة (Backup)
في حال الرغبة بأخذ نسخة جديدة وتحديث الملف:
```powershell
$env:PGPASSWORD = "postgres"
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -U postgres -d newchat --clean --if-exists --no-owner --no-privileges --encoding=UTF8 -f backups\database\newchat_backup.sql
```
