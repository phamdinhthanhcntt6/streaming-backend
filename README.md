# Streaming Backend

Backend API cho dự án Streaming Web phục vụ mục đích học tập.

## Công nghệ

- Node.js và TypeScript
- Express 5
- PostgreSQL
- Prisma ORM 7
- JWT lưu trong HttpOnly cookie

## Yêu cầu

- Node.js và npm
- PostgreSQL đang chạy
- Một database PostgreSQL dành cho dự án

## Cài đặt

Từ thư mục `streaming-backend`:

```bash
npm install
```

Tạo file `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/streaming_db"
JWT_SECRET="thay-bang-mot-chuoi-bi-mat-dai-va-ngau-nhien"
CLIENT_URL="http://localhost:3000"
PORT=8000
NODE_ENV="development"
```

Các biến Cloudinary chỉ cần thiết khi triển khai upload ảnh/media:

```env
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

Không commit file `.env` hoặc thông tin đăng nhập database lên Git.

## Chạy dự án

Chạy development server và tự reload khi source thay đổi:

```bash
npm run dev
```

Mặc định API chạy tại `http://localhost:8000`.

Build production:

```bash
npm run build
```

Lệnh build sẽ chạy `prisma generate` trước, sau đó biên dịch TypeScript vào thư mục `dist`.

Chạy bản production đã build:

```bash
npm start
```

Kiểm tra source:

```bash
npm run typecheck
npm run lint
```

Tự động sửa các lỗi lint có thể sửa được:

```bash
npm run lint:fix
```

## Prisma

Prisma đọc kết nối database từ `DATABASE_URL` trong `.env`. Schema nằm tại `prisma/schema.prisma`, migration nằm trong `prisma/migrations`, và Prisma Client được generate vào `src/generated/prisma`.

### Các lệnh thường dùng

| Mục đích | Lệnh |
| --- | --- |
| Generate Prisma Client | `npx prisma generate` |
| Kiểm tra schema hợp lệ | `npx prisma validate` |
| Format file schema | `npx prisma format` |
| Xem phiên bản Prisma | `npx prisma version` |
| Xem trạng thái migration | `npx prisma migrate status` |
| Mở giao diện xem dữ liệu | `npx prisma studio` |
| Mở Studio tại port khác | `npx prisma studio --port 5556` |

### Xem, thêm, sửa và xóa dữ liệu

Chạy:

```bash
npx prisma studio
```

Prisma Studio mặc định mở tại `http://localhost:5555`. Trong giao diện này có thể:

- Xem dữ liệu theo từng model/table.
- Thêm record mới.
- Sửa record hiện có.
- Xóa record.
- Lọc và sắp xếp dữ liệu.

Nếu không muốn Prisma tự mở trình duyệt:

```bash
npx prisma studio --browser none
```

### Tạo migration khi thay đổi schema

Ví dụ thêm field vào `User` trong `prisma/schema.prisma`:

```prisma
model User {
  // Các field hiện tại...
  bio String?
}
```

Tạo và áp dụng migration trong môi trường development:

```bash
npx prisma migrate dev --name add_user_bio
```

Tên migration nên dùng chữ thường và dấu gạch dưới, ví dụ:

```bash
npx prisma migrate dev --name create_track
npx prisma migrate dev --name add_playlist
npx prisma migrate dev --name add_user_avatar
```

`migrate dev` sẽ:

1. So sánh Prisma schema với database.
2. Tạo file SQL mới trong `prisma/migrations`.
3. Áp dụng migration vào database development.
4. Generate lại Prisma Client.

Chỉ tạo file migration để kiểm tra/chỉnh SQL, chưa áp dụng vào database:

```bash
npx prisma migrate dev --name add_track --create-only
```

Sau khi kiểm tra file SQL, áp dụng migration bằng:

```bash
npx prisma migrate dev
```

Không sửa migration đã được áp dụng và chia sẻ cho người khác. Nếu schema cần thay đổi tiếp, hãy tạo migration mới.

### Áp dụng migration ở production hoặc staging

```bash
npx prisma migrate deploy
```

`migrate deploy` chỉ áp dụng các migration đang chờ; nó không tự tạo migration mới. Không dùng `migrate dev` trên production.

### Reset database development

```bash
npx prisma migrate reset
```

> **Cảnh báo:** lệnh này xóa toàn bộ dữ liệu, tạo lại database schema và chạy lại tất cả migration. Chỉ dùng cho database development khi chắc chắn không cần giữ dữ liệu.

### Đồng bộ schema nhanh không tạo migration

```bash
npx prisma db push
```

`db push` phù hợp khi thử nghiệm schema nhanh hoặc làm prototype. Lệnh này không tạo lịch sử migration, vì vậy khi tính năng đã ổn định nên dùng `prisma migrate dev`.

Không nên trộn `db push` và migration tùy tiện trên cùng database vì dễ tạo schema drift.

### Lấy schema từ database có sẵn

```bash
npx prisma db pull
npx prisma generate
```

> **Lưu ý:** `db pull` cập nhật `prisma/schema.prisma` dựa trên database hiện tại. Nên commit hoặc sao lưu thay đổi schema trước khi chạy.

### Seed dữ liệu mẫu

Dự án có seed tại `prisma/seed.ts`. Chạy bằng một trong hai lệnh:

```bash
npx prisma db seed
npm run seed
```

Seed dùng `upsert` nên có thể chạy lại mà không tạo trùng nghệ sĩ, bài hát, thể loại hoặc bảng xếp hạng. Các `audioUrl` là đường dẫn placeholder; cần bổ sung file demo hợp pháp trước khi phát nhạc.

## Quy trình thay đổi database đề xuất

```text
Sửa prisma/schema.prisma
        ↓
npx prisma format
        ↓
npx prisma validate
        ↓
npx prisma migrate dev --name ten_thay_doi
        ↓
npm run typecheck
        ↓
Kiểm tra dữ liệu bằng npx prisma studio
```

Khi pull code có migration mới từ Git:

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

Khi deploy production:

```bash
npm install
npx prisma migrate deploy
npm run build
npm start
```

## API xác thực hiện tại

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Đăng ký tài khoản |
| `POST` | `/api/auth/login` | Đăng nhập và tạo HttpOnly cookie |
| `POST` | `/api/auth/logout` | Xóa cookie đăng nhập |
| `GET` | `/api/auth/me` | Xác minh cookie và trả người dùng hiện tại |

Frontend phải gửi request với credentials để trình duyệt gửi cookie:

```ts
axios.create({
  baseURL: "http://localhost:8000/api",
  withCredentials: true,
});
```

## Cấu trúc chính

```text
streaming-backend/
├── prisma/
│   ├── migrations/       # Lịch sử migration SQL
│   └── schema.prisma     # Database schema
├── src/
│   ├── core/             # Database và cấu hình dùng chung
│   ├── generated/prisma/ # Prisma Client được generate, không commit
│   ├── modules/          # Các module API
│   └── server.ts         # Entry point
├── prisma.config.ts
├── package.json
└── tsconfig.json
```

## Một số lỗi Prisma thường gặp

### Không kết nối được database

Kiểm tra PostgreSQL đang chạy và `DATABASE_URL` trong `.env` đúng username, password, host, port và database name.

### Prisma Client chưa được generate

```bash
npx prisma generate
```

### Migration và database không đồng bộ

Kiểm tra trước bằng:

```bash
npx prisma migrate status
```

Với database development có thể bỏ toàn bộ dữ liệu, dùng `npx prisma migrate reset`. Với production, không reset; cần kiểm tra migration lỗi và xử lý bằng `prisma migrate resolve` theo đúng trạng thái thực tế.

### Thay đổi schema nhưng TypeScript chưa nhận type mới

```bash
npx prisma generate
npm run typecheck
```
