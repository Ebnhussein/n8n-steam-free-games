# Troubleshooting / حل المشاكل

[Home](../README.md) · [English setup](SETUP.en.md) · [دليل التشغيل بالعربي](SETUP.ar.md)

## English

Start by identifying which layer failed: Docker, helper authentication, Steam authentication, discovery, claim verification, or Telegram. A green n8n execution only means no workflow exception occurred; inspect each game's status.

### Result statuses

| Status | What happened | What to do |
| --- | --- | --- |
| `claimed` | The helper confirmed app/package ownership after a request | No further action for that result |
| `already_owned` | Steam says the account already owns the app/package | Skipped; no notification is sent |
| `eligible_dry_run` | Relevant dry-run checks passed; no grant was requested | Review dependencies/reasons before enabling real claims |
| `needs_review` | Paid/missing base, unclear license, failed dependency, or attempt limit | Read the reason; don't assume ownership |
| `verification_pending` | A claim request was sent, but ownership was not confirmed | Check your Steam account; do not report it as success |
| `error` | An individual game's attempt failed | Read the reason; report only redacted details |

### Common problems

| Symptom | Likely cause / next step |
| --- | --- |
| `docker: command not found` / missing Compose | Install Docker Engine and Compose v2 using the official documentation |
| Docker socket permission denied | Use the host's approved Docker access, such as `sudo docker ...`; do not make the socket world-writable |
| Login says a TTY is required | Run the login command from an interactive terminal; do not pipe a heredoc or run detached |
| `InvalidPassword` / Steam Guard mismatch | Check the login name and current code; use the code Steam just sent for email Guard |
| Steam blocks the sign-in | Resolve the approval/block through Steam. The helper cannot bypass it |
| `STEAM_LOGIN_REQUIRED`, token expired/revoked | Pause the workflow, stop the helper, log in again, then restart |
| Helper is `healthy`, but login fails | Health only checks HTTP availability; it does not validate Steam credentials |
| `ENOTFOUND steam-helper` / cannot resolve host | n8n and the helper are not on the same Docker network; connect the execution worker too if applicable |
| `ECONNREFUSED` / timeout | Check `docker compose ps`, logs, container networking, and outbound access |
| HTTP `401 Unauthorized` | Header Auth must use `Name = X-API-Key` and the generated helper key as Value |
| HTTP `400` | Send an explicit JSON boolean: `{"dryRun":true}` or `{"dryRun":false}`; a string `"false"` is invalid |
| HTTP `409` | A run is already active; let it finish and avoid concurrent manual runs |
| HTTP `502` | The helper encountered a Steam/login/search failure; read the returned error and logs |
| HTTP `429` from Steam | Rate limiting; pause repeated manual retries and inspect the next scheduled run |
| `candidateCount: 0` | No offers were found by this Store query. This does not prove there are no promotions anywhere |
| SteamDB shows games that are missing | Compare **Free to Keep** versus **Play For Free**; regional filters, bundles, and age gates may also differ |
| `Free license package is missing or ambiguous` | Store markup changed, an age gate intervened, or the license cannot be identified safely |
| DLC requires a paid base | Expected block. The project does not buy that base |
| A free base still cannot be added | Some free games require Steam-client activation; no unambiguous web license was found |
| Telegram says `chat not found` | Start the bot, verify chat ID, preserve a negative group's ID, and check bot membership/permissions |
| Telegram says `Forbidden` | The user blocked the bot, or the bot lacks access/permissions |
| Telegram photo cannot be fetched | Steam's image URL may be unavailable to Telegram; inspect the execution and retry later. The photo path does not automatically fall back after a failed fetch |
| Manual runs repeat notifications | Expected: n8n workflow static data is persisted for successful production runs, not manual tests |
| Error alert says `Example Error Message` | Dummy Error Trigger test data; this is not evidence of a real Steam failure |
| Credentials disappeared after redeploy | Check whether you changed the Compose project identity or removed the data volume |

### Useful commands

Run in the repository directory:

```bash
docker compose ps
docker compose logs --tail=100 steam-helper
docker network inspect steam-free-games
docker stats --no-stream
```

Do not publicly paste raw network inspection results, tokens, auth files, or account responses. For a login reset, use [maintenance](SETUP.en.md#11-maintenance). Pause scheduling before token-related diagnostic commands.

### There are no offers; how do I test Telegram?

An empty result intentionally produces no messages. Temporarily test the text notification node with a fixed harmless message as described in [dry-run setup](SETUP.en.md#91-dry-run), then restore its expression and wiring. Sending a test message verifies delivery, not Steam discovery or claims.

## عربي

حدد المشكلة فين: Docker، مفتاح الربط، دخول Steam، البحث، تأكيد الإضافة، ولا تليجرام. لون التنفيذ الأخضر في n8n مش معناه إن كل الألعاب اتضافت؛ لازم تبص على حالة كل نتيجة.

### الحالات بالعربي

| الحالة | معناها | تعمل إيه؟ |
| --- | --- | --- |
| `claimed` | اتأكدنا من ملكية التطبيق أو الباكدج بعد الطلب | النتيجة دي مؤكدة |
| `already_owned` | موجودة عندك بالفعل | بيتخطاها من غير تنبيه |
| `eligible_dry_run` | اجتازت الفحص المناسب للتجربة، من غير طلب إضافة | راجع الاعتمادات والأسباب قبل التفعيل |
| `needs_review` | أساسية مدفوعة/ناقصة، ترخيص مش واضح، اعتماد فشل، أو حد محاولات | اقرأ السبب؛ دي مش إضافة ناجحة |
| `verification_pending` | اتبعت طلب لكن الملكية لسه مش مؤكدة | راجع حساب Steam؛ متعتبرهاش نجاح |
| `error` | محاولة لعبة معينة فشلت | راجع السبب واخفي البيانات الخاصة قبل مشاركة الخطأ |

### المشاكل الشائعة

| المشكلة | السبب المحتمل أو الحل |
| --- | --- |
| Docker أو Compose مش موجودين | ثبّتهم من التعليمات الرسمية قبل أوامر المشروع |
| صلاحيات Docker مرفوضة | استخدم طريقة سيرفرك المعتادة مثل `sudo docker ...`؛ متفتحش الـsocket للكل |
| تسجيل الدخول بيطلب TTY | افتح ترمينال تفاعلي، ومتشغّلش أمر الدخول في pipe أو detached |
| الباسورد/كود Guard غلط | راجع اسم تسجيل الدخول والكود الحالي؛ كود الإيميل يكون اللي وصلك حالًا |
| Steam حظر الدخول | حل الحظر والتأكيد من Steam؛ المشروع مش بيتجاوزه |
| التوكن انتهى أو اتلغى | وقف الجدولة والخدمة، وسجّل من جديد، وبعدها شغّلهم |
| الخدمة healthy بس Steam مش داخل | healthy فحص HTTP فقط، مش صلاحية جلسة Steam |
| `ENOTFOUND steam-helper` | اربط n8n والخدمة بنفس شبكة Docker؛ اربط workers التنفيذ لو موجودين |
| `ECONNREFUSED` أو timeout | راجع الخدمة واللوجات والشبكات والاتصال الخارجي |
| `401 Unauthorized` | اسم الهيدر لازم `X-API-Key` وقيمته مفتاح الخدمة، مش توكن تليجرام |
| `400` | ابعت JSON فيه `dryRun` قيمة boolean؛ `false` مش النص `"false"` |
| `409` | فيه تشغيل شغال بالفعل؛ استنى ومتكررّش التشغيل بالتوازي |
| `502` | الخدمة قابلت مشكلة Steam/دخول/بحث؛ راجع الخطأ واللوجات |
| `429` من Steam | فيه rate limit؛ وقف إعادة المحاولات اليدوية المتكررة |
| `candidateCount: 0` | البحث ده ملقاش عروض؛ مش إثبات إن كل Steam مفيهوش عروض |
| SteamDB فيه ألعاب مش ظاهرة | فرّق بين Free to Keep وPlay For Free؛ كمان الدولة والباندلز والعمر ممكن يغيّروا النتائج |
| الباكدج المجاني مش واضح | ممكن شكل الصفحة اتغير، أو Age Gate، أو الترخيص مش متاح للقراءة بوضوح |
| الـDLC محتاج أساسية مدفوعة | طبيعي يتمنع؛ المشروع مش بيشتري ألعاب |
| الأساسية مجانية ومش بتتضاف | بعض الألعاب محتاجة Steam client؛ الترخيص المجاني على الويب مش دايمًا واضح |
| تليجرام `chat not found` | دوس Start، راجع Chat ID والسالب لو موجود وصلاحيات البوت |
| تليجرام `Forbidden` | ممكن البوت محظور أو مش عنده صلاحية يوصل للشات |
| الصورة فشلت في تليجرام | رابط Steam ممكن مش متاح لتليجرام؛ راجع التنفيذ. مفيش تحويل تلقائي لنص بعد فشل تحميل الصورة |
| الرسالة بتتكرر في الاختبار اليدوي | طبيعي؛ n8n مش بيحفظ static data للتجارب اليدوية |
| `Example Error Message` | بيانات اختبار Error Trigger، مش خطأ Steam فعلي |
| بيانات الدخول اختفت بعد النشر | راجع اسم مشروع Compose، وهل الـvolume اتغيّر أو اتمسح |

### أوامر مفيدة

من مجلد المشروع:

```bash
docker compose ps
docker compose logs --tail=100 steam-helper
docker network inspect steam-free-games
docker stats --no-stream
```

متنشرش ناتج فحص الشبكة كامل أو ملفات الدخول أو التوكنات أو ردود الحساب. [إعادة تسجيل الدخول والصيانة](SETUP.ar.md#11-الصيانة-والتحديث). وقف الجدولة قبل أي تشخيص ممكن يجدد التوكن.

### مفيش عروض؛ أختبر تليجرام إزاي؟

نتيجة البحث الفاضية مش بتبعت رسائل. تقدر تختبر نود النص برسالة ثابتة مؤقتًا زي [شرح التجربة](SETUP.ar.md#91-تجربة-بدون-إضافة)، وبعدها ترجع الـexpression والسلك. وصول رسالة اختبار بيأكد التوصيل لتليجرام فقط، مش اكتشاف العروض أو إضافتها.
