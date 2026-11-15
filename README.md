# NewChat v2.0 (بنية حديثة بدون Docker لملايين المستخدمين)

## المتطلبات المحلية (Windows - بدون Docker)
- **Node.js** `>= 20` و **pnpm** `11.x`
- **PostgreSQL 18** يعمل محلياً على المنفذ `5432`
- **Memurai / Redis** يعمل محلياً على المنفذ `6379`
- **MySQL (`safarihost`)** على المنفذ `3308` كمصدر للترحيل لمرة واحدة

## الإعداد الأولي
1. انسخ `.env.example` إلى `.env` وضع كلمة مرور PostgreSQL في `DATABASE_URL`:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/newchat
   ```
2. أنشئ قاعدة البيانات `newchat` في PostgreSQL 18 ثم ادفع الجداول الـ 39:
   ```powershell
   pnpm db:push
   ```
3. رحّل كافة البيانات من MySQL (`safarihost`) إلى PostgreSQL 18:
   ```powershell
   pnpm db:migrate-legacy
   ```
4. شغّل كامل المنظومة (`api` + `gateway` + `worker` + `web`):
   ```powershell
   pnpm dev
   ```

## المنافذ الافتراضية
- **واجهة الويب (React 19 + Vite):** `http://127.0.0.1:5173`
- **خادم API (Fastify v5):** `http://127.0.0.1:3003`
- **بوابة Socket.IO (MsgPack + Redis Adapter):** `http://127.0.0.1:3004`
- **تطبيق الموبايل (Expo React Native):** `pnpm --filter @newchat/mobile start`
