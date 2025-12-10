# Creative Asset Review System

Ứng dụng web để review tài sản sáng tạo (images, videos, image sequences, PDFs, và 3D models) với công cụ chú thích, bình luận timestamped cho video, và quản lý phiên bản. README này đã cập nhật để phản ánh trạng thái hiện tại của repository (components, stores, viewers và hạ tầng được tích hợp).

## ✨ Hiện trạng & Tính năng chính

### Admin (Creator)
- 🔐 Đăng nhập qua Firebase Auth (admin flows được bảo vệ)
- 📁 Quản lý Projects và Files (stores: `src/stores/projects.ts`, `src/stores/files.ts`)
- 📤 Upload files: image (PNG/JPG/WebP), video (MP4), PDF, image sequences và 3D models (GLB) (`src/components/files/FileUploader.tsx`, `SequenceUploader.tsx`)
- 🔄 Versioning: mỗi file có phiên bản, có thể chuyển giữa các version trong `FileViewDialog.tsx`
- 💬 Quản lý bình luận realtime, resolve/unresolve (`src/stores/comments.ts`, `CommentsList.tsx`)
- ✏️ Annotation tools: `AnnotationCanvasKonva.tsx` + `AnnotationToolbar.tsx` (pen/rect/arrow/undo/redo)
- 🔗 Public review links: có hỗ trợ mở link review cho reviewer (cơ chế public read theo mặc định; xem phần Security)

### Client (Reviewer)
- 🚫 Có thể truy cập mà không cần đăng ký (public reviewer flow)
- 👤 Nhập tên hiển thị (lưu trong `localStorage` bởi UI reviewer)
- 🖼️ Xem file trong các viewer chuyên biệt: images, PDF (`PDFViewer.tsx`), video (`CustomVideoPlayer.tsx`), image sequences (`ImageSequenceViewer.tsx`), 3D GLB (`GLBViewer.tsx`)
- 💬 Bình luận: hỗ trợ timestamped comments cho video, attachments trên comment
- ⚡ Cập nhật realtime thông qua Firestore onSnapshot

## 🛠️ Tech Stack (chính xác theo repo)

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS, shadcn/ui style components
- **State:** Zustand (stores nằm ở `src/stores`)
- **Viewers / Canvas:** `react-pdf`, `react-konva` (Konva), `react-three-fiber` + `three.js`, `@mediamonks/fast-image-sequence`
- **Backend / Services:** Firebase (Auth, Firestore, Storage)
- **Deployment hints:** Vercel (`vercel.json`) and Firebase Hosting (`firebase.json`)

## 📦 Cài đặt nhanh

1. Clone & cài dependencies

```powershell
git clone <repo-url>
cd Review-system
npm install
```

2. Tạo Firebase Project và bật Auth/Firestore/Storage

3. Thêm biến môi trường (copy từ `.env.example` nếu có)

4. Chạy dev

```powershell
npm run dev
```

Mở http://localhost:5173

Xem phần chi tiết cài đặt Firebase và deploy trong file gốc nếu cần (phần hướng dẫn trước đây vẫn áp dụng với các biến `VITE_*`).

## 📂 Cấu trúc quan trọng (tóm tắt)

```
src/
├── components/
│   ├── files/               # FileUploader, FilesList, FileViewDialog, FileCard
│   ├── viewers/             # PDFViewer, CustomVideoPlayer, GLBViewer, ImageSequenceViewer
│   ├── annotations/         # AnnotationCanvasKonva, AnnotationToolbar
│   └── ui/                  # shared UI components
├── lib/
│   ├── firebase.ts          # Firebase init + helpers (upload/delete helpers)
│   └── storageUtils.ts      # helpers (formatBytes, export, etc.)
├── pages/
│   └── ReviewPage.tsx       # public review entry point
├── stores/                  # Zustand stores: auth, files, comments, projects
└── App.tsx
```

## 🔒 Security (hiện trạng và lưu ý)

- Hiện tại repo sử dụng Firestore + Storage với mô hình public read cho links review (README trước đây mô tả public read). Điều này có nghĩa là bất kỳ ai có URL file (nếu công khai) hoặc review link có thể truy cập nội dung.
- Có `firestore.rules` và `storage.rules` trong repo nhưng bạn nên kiểm tra lại rules production để đảm bảo:
  - Reviewer public không thể ghi vào admin-only paths.
  - Giới hạn kích thước file và kiểu file upload.
- Rủi ro đã nhận diện từ scan:
  - Orphaned attachments: code client hiện không chắc chắn dọn sạch attachments khi comment/file bị xóa — cần thêm Cloud Function để garbage-collect.
  - Thiếu granular roles / SSO / audit logs cho enterprise.

Khuyến nghị ngắn gọn:
- Thay public download bằng signed URLs (Cloud Function) nếu asset nhạy cảm.
- Thêm invite-only review links nếu cần private reviews.
- Triển khai Cloud Functions để dọn dẹp attachments khi documents bị xóa.

## 🔍 Data model (tóm tắt từ code)

- Projects: `id`, `name`, `createdAt`, `status`, `adminEmail`
- Files: `id`, `projectId`, `name`, `type`, `versions[]`, `currentVersion` (mỗi version có url + metadata)
- Comments: `id`, `projectId`, `fileId`, `version`, `userName`, `content`, `timestamp` (video seconds or null), `isResolved`, `createdAt`

Định dạng và fields chi tiết có trong `src/stores/*` và được dùng trên client.

## 🚧 Known limitations & security notes

- Public read default có thể không phù hợp cho tài sản nhạy cảm — cân nhắc signed URLs / invite tokens.
- No server-side virus scan currently — nếu bạn chấp nhận uploads từ nguồn không tin cậy, hãy thêm Cloud Function scan.
- Realtime annotations live-sharing chưa được triển khai (hiện annotation là per-client + saved per comment). Nếu cần live-collaboration, kế hoạch là lưu action deltas vào Firestore hoặc một WebSocket service.

## Tài liệu bổ sung

- Báo cáo đánh giá chi tiết và đề xuất tính năng đã được tạo: `REPORT_DETAILED.md` (gốc repo) — chứa so sánh đối thủ, đề xuất 11 tính năng, và hướng tiếp theo.

## Roadmap ngắn hạn (gợi ý từ scan)

- [ ] Signed download URLs (Cloud Function)
- [ ] Invite-only review links / tokenized links
- [ ] Cloud Function để dọn dẹp attachments khi xóa
- [ ] Threaded comments + soft-delete

## License

MIT

---

Nếu bạn muốn, tôi có thể tiếp tục và:
- chuyển README sang tiếng Anh; hoặc
- tạo task breakdown + ước lượng giờ cho 3 tính năng ưu tiên (signed URLs, invite-only links, attachment cleanup).
