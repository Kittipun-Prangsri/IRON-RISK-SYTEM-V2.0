# Iron Zero Risk — ติดตั้งบน Server โรงพยาบาล (Linux)

ระบบรันด้วย Node.js บน server ของโรงพยาบาล และเก็บข้อมูลในฐานข้อมูล PostgreSQL บน **Supabase** หน้าเว็บใช้ไฟล์ชุดเดียวกับเวอร์ชัน Google Apps Script (`../src/*.html`)

```
เบราว์เซอร์ ──HTTPS──► nginx ──► Node.js (พอร์ต 3000) ──► Supabase: schema iron_risk (ข้อมูลหลัก)
                                        ├──► HOSxP DB (บัญชีอ่านอย่างเดียว)
                                        └──► moph.id.th / provider.id.th (ล็อกอิน Provider ID)
```

## 1. สิ่งที่ต้องมี
- Linux (Ubuntu 22.04+/Rocky 9+), **Node.js 20 ขึ้นไป**, nginx
- โปรเจกต์ Supabase (ควรเลือก region **Singapore**)
- server ต้องเชื่อมต่อออกไปที่ `*.pooler.supabase.com` (พอร์ต 5432), `moph.id.th` และ `provider.id.th` (HTTPS 443) ได้

> **ข้อมูลเด็กจะอยู่บน cloud ของ Supabase ไม่ได้อยู่ในโรงพยาบาล** ควรได้รับอนุมัติตามนโยบาย PDPA ของโรงพยาบาลก่อนใช้งานจริง

## 2. เตรียม Supabase
1. เปิด Supabase Dashboard → โปรเจกต์ → ปุ่ม **Connect** → เลือก **Session pooler** (พอร์ต 5432)
2. คัดลอก URI ทั้งบรรทัด แล้วแทน `[YOUR-PASSWORD]` ด้วยรหัสฐานข้อมูล (ลืมรหัสได้ที่ Database → Settings → Reset database password)
3. นำไปใส่ `DATABASE_URL=` ใน `.env` — **ใช้ Session pooler เท่านั้น** ไม่ใช่ Transaction pooler (6543)
4. (แนะนำ) Database → Settings → SSL Configuration → Download certificate แล้วตั้ง `DB_SSL_CA=/opt/iron-risk/server/supabase-ca.crt`

ตารางจะถูกสร้างใน schema `iron_risk` **ไม่ใช่ `public`** — ห้ามเพิ่ม `iron_risk` ใน Settings → API → Exposed schemas เพราะจะเปิดให้อ่านผ่าน API ได้ (`db:init` เปิด RLS และถอนสิทธิ์ anon/authenticated ไว้อีกชั้นแล้ว)

บัญชี HOSxP อ่านอย่างเดียว (สร้างบน HOSxP โดยผู้ดูแล):
```sql
CREATE USER 'iron_risk_ro'@'<IP server>' IDENTIFIED BY '<รหัสผ่าน>';
GRANT SELECT ON hos.opduser TO 'iron_risk_ro'@'<IP server>';
```

## 3. ติดตั้งโปรแกรม
```bash
sudo mkdir -p /opt/iron-risk && sudo chown $USER /opt/iron-risk
git clone https://github.com/Kittipun-Prangsri/IRON-RISK-SYTEM-V2.0.git /opt/iron-risk
cd /opt/iron-risk/server
npm ci --omit=dev
cp .env.example .env && chmod 600 .env
nano .env          # กรอกค่าตามหัวข้อ 4
npm run db:init    # สร้าง schema และตาราง บน Supabase
```

## 4. ตั้งค่า `.env`
| ค่า | คำอธิบาย |
|---|---|
| `PUBLIC_BASE_URL` | URL ที่ผู้ใช้เปิด เช่น `https://ironrisk.khh.go.th` |
| `SESSION_SECRET` | สุ่มใหม่: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DATABASE_URL` | connection string จาก Supabase (หัวข้อ 2) |
| `DB_SCHEMA` | `iron_risk` (ค่าเริ่มต้น) |
| `HOSXP_ENABLED=true`, `HOSXP_DB_*` | บัญชี `iron_risk_ro` และชื่อฐานข้อมูล HOSxP |
| `HOSXP_PASSWORD_HASH` | วิธีเก็บ `opduser.passweb` ของโรงพยาบาล: `md5` หรือ `plain` **ต้องยืนยันกับผู้ดูแล HOSxP** |
| `HEALTHID_*`, `PROVIDERID_*` | ค่าที่ได้จากสำนักสุขภาพดิจิทัล |
| `DEV_LOGIN` | ต้องเป็น `false` เสมอบน server จริง |

**ต้องลงทะเบียน Redirect URI ใหม่** กับ MOPH (provider.id@moph.go.th) เป็น `https://<โดเมน>/auth/healthid/callback`
ถ้าใช้ LINE Login ให้ตั้ง Callback URL ใน LINE Developers เป็น `https://<โดเมน>/`

## 5. ย้ายข้อมูลจาก Google Sheet (ครั้งเดียว)
ใน Google Sheets เปิดแต่ละแท็บ → ไฟล์ → ดาวน์โหลด → CSV แล้วรัน:
```bash
node scripts/import-sheets.js --children "ข้อมูลเด็ก.csv" --users Users.csv \
  --medicine MedicineLog.csv --activity ActivityLog.csv --dry-run   # ลองก่อน ไม่บันทึกจริง
node scripts/import-sheets.js --children "ข้อมูลเด็ก.csv" --users Users.csv \
  --medicine MedicineLog.csv --activity ActivityLog.csv             # นำเข้าจริง
```
คะแนนความเสี่ยงจะถูกคำนวณใหม่ตามเกณฑ์ปัจจุบัน ถ้ารันซ้ำจะอัปเดตตาม ID ไม่เพิ่มแถวซ้ำ **ลบไฟล์ CSV ทิ้งหลังนำเข้าเสร็จ** เพราะมีข้อมูลเด็ก

ผู้ใช้เดิมที่ล็อกอินด้วยบัญชี HOSxP ต้องกรอกช่อง `hosxp_login` (loginname ของ HOSxP) ในตาราง `users` ก่อน ไม่อย่างนั้นระบบจะสร้างบัญชีใหม่สถานะรออนุมัติ

## 6. รันเป็น service (systemd)
`/etc/systemd/system/iron-risk.service`
```ini
[Unit]
Description=Iron Zero Risk
After=network-online.target

[Service]
WorkingDirectory=/opt/iron-risk/server
ExecStart=/usr/bin/node src/index.js
Restart=always
User=ironrisk
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
```bash
sudo useradd --system --no-create-home ironrisk && sudo chown -R ironrisk /opt/iron-risk
sudo systemctl daemon-reload && sudo systemctl enable --now iron-risk
journalctl -u iron-risk -f      # ดู log
```

## 7. nginx + HTTPS
```nginx
server {
    listen 443 ssl;
    server_name ironrisk.khh.go.th;
    ssl_certificate     /etc/ssl/certs/ironrisk.crt;
    ssl_certificate_key /etc/ssl/private/ironrisk.key;
    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server { listen 80; server_name ironrisk.khh.go.th; return 301 https://$host$request_uri; }
```

## 8. สำรองข้อมูล
Supabase แผนฟรีไม่มี backup ให้ดาวน์โหลด ควรสำรองเองทุกคืน (ต้องติดตั้ง `postgresql` client เวอร์ชันเดียวกับ Supabase ขึ้นไป):
```bash
# crontab ของ root: 02:00 ทุกคืน เก็บ 30 วัน (อ่าน DATABASE_URL จาก .env)
0 2 * * * . /opt/iron-risk/server/.env && pg_dump "$DATABASE_URL" -n iron_risk | gzip > /backup/iron_risk_$(date +\%F).sql.gz && find /backup -name 'iron_risk_*.sql.gz' -mtime +30 -delete
```
ไฟล์สำรองมีข้อมูลเด็ก — เก็บในเครื่องที่ปลอดภัยและจำกัดสิทธิ์ (`chmod 700 /backup`)

## 9. อัปเดตเวอร์ชัน
```bash
cd /opt/iron-risk && git pull && cd server && npm ci --omit=dev && npm run db:init && sudo systemctl restart iron-risk
```

## ความแตกต่างจากเวอร์ชัน Google Apps Script
- **ล็อกอินที่รองรับ:** บัญชี HOSxP, Provider ID (MOPH), LINE Login
- **ยังไม่รองรับ:** Google SSO, OTP (ยังไม่มีระบบส่ง SMS), LIFF ในเวอร์ชัน GAS สองแบบนี้ไม่ได้ตรวจรหัสจริงฝั่ง server
- **Session:** เก็บใน cookie ที่ server ตรวจทุกครั้ง ถ้าปิดบัญชีในระบบ ผู้ใช้จะถูกออกจากระบบทันที
- **สิทธิ์:** อสม. เห็นและแก้ได้เฉพาะหมู่บ้านที่รับผิดชอบ การลบข้อมูล นำเข้า จัดการผู้ใช้ และตั้งค่า ทำได้เฉพาะเจ้าหน้าที่
- **Secret:** อยู่ใน `.env` เท่านั้น ไม่ส่งไปที่หน้าเว็บ
- **LINE Notify:** ปิดให้บริการแล้ว (31 มี.ค. 2568) จึงไม่มีการแจ้งเตือนเด็กเสี่ยงสูงทาง LINE Notify

## ทดสอบ (สำหรับนักพัฒนา)
```bash
npm test   # เปิด PostgreSQL ชั่วคราวเอง (embedded-postgres); จำลอง HOSxP ด้วย MySQL ที่ localhost (iron_risk_hosxp_test)
```
