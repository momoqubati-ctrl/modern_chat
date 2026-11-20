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
2. أنشئ قاعدة البيانات `newchat` في PostgreSQL 18 ثم ادفع مخطط قاعدة البيانات:
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

## اقتصاد الهدايا وبوابة مالك الاستضافة
- شرائح رسوم المنصة الافتراضية: 1–10 كوينز = 5%، و11–100 = 10%، و101 فأكثر = 15%. تُنشأ الشرائح والإعدادات ومحافظ النظام تلقائياً عند بدء API.
- تُخصم رسوم الاستضافة حسب `HOSTING_FEE_PERCENT` (10% افتراضياً) وتُضاف إلى دفتر محفظة مالك الاستضافة ضمن معاملة الهدية نفسها. ويمكن لمالك الاستضافة تسجيل تمويل محفظة الموقع مع مرجع تدقيق ومفتاح منع التكرار.
- اضبط `HOSTING_PORTAL_PATH` في بيئة الخادم على مسار خاص وآمن بطول 20 حرفاً على الأقل، ثم عيّن `HOSTING_OWNER_USERNAME` و`HOSTING_OWNER_PASSWORD_HASH` (تجزئة bcrypt لكلمة مرور قوية). لا تضع هذه القيم في متغيرات `VITE_*` أو في الواجهة الأمامية.
- لا يتوفر سحب خارجي حالياً؛ تُحفظ الرسوم في المحفظة وسجل الحركات إلى أن يُضاف مسار سحب معتمد. يتطلب الإنتاج إعداد المسار وبيانات الدخول، وإلا يرفض API بدء التشغيل.
- غيّر `GIFT_DEFAULT_MAX_QTY` و`GIFT_DEFAULT_RATE_LIMIT_MAX` و`GIFT_DEFAULT_RATE_LIMIT_WINDOW_MS` لضبط القيم الابتدائية؛ بعد إنشاء الإعدادات، تُدار هذه القيم من لوحة التحكم.

## المنافذ الافتراضية
- **واجهة الويب (React 19 + Vite):** `http://127.0.0.1:5173`
- **خادم API (Fastify v5):** `http://127.0.0.1:3003`
- **بوابة Socket.IO (MsgPack + Redis Adapter):** `http://127.0.0.1:3004`
- **تطبيق الموبايل (Expo React Native):** `pnpm --filter @newchat/mobile start`
