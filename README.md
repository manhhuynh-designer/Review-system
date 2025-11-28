# Creative Asset Review System

Ứng dụng web review file sáng tạo (hình ảnh, video, 3D model) với hệ thống bình luận realtime và quản lý version.

## ✨ Tính năng

### Admin (Creator)
- 🔐 Đăng nhập Firebase Auth
- 📁 Quản lý Projects (CRUD)
- 📤 Upload files: Image (PNG/JPG/WebP), Video (MP4/MOV), 3D Model (GLB)
- 🔄 Quản lý version (v1 → v2 → v3...)
- 💬 Xem và resolve bình luận realtime
- 🔗 Tạo link review công khai

### Client (Reviewer)
- 🚫 Không cần đăng nhập
- 👤 Nhập tên hiển thị (lưu localStorage)
- 🖼️ Viewer tối giản, chất lượng cao
- 💬 Bình luận thông minh: video comments gắn timestamp
- ⚡ Cập nhật realtime

## 🛠️ Tech Stack

- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS (dark mode default) + Shadcn/UI
- **State:** Zustand + Firestore realtime
- **3D:** Three.js + React Three Fiber
- **Backend:** Firebase (Auth + Firestore + Storage)
- **Router:** React Router v6

## 📦 Cài đặt

### 1. Clone và cài dependencies

\`\`\`powershell
git clone <repo-url>
cd Review-system
npm install
\`\`\`

### 2. Tạo Firebase Project

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Tạo project mới
3. Bật các dịch vụ:
   - **Authentication** → Email/Password
   - **Firestore Database** → Start in production mode
   - **Storage** → Start in production mode

### 3. Lấy Firebase Config

1. Project Settings → General → Your apps → Web app
2. Copy config values
3. Tạo file \`.env\` từ template:

\`\`\`powershell
Copy-Item .env.example .env
\`\`\`

4. Điền values vào \`.env\`:

\`\`\`env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
\`\`\`

### 4. Deploy Firebase Rules

\`\`\`powershell
# Cài Firebase CLI (nếu chưa có)
npm install -g firebase-tools

# Login
firebase login

# Init project (chọn Firestore, Storage, Hosting)
firebase init

# Deploy rules và indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
\`\`\`

### 5. Tạo Admin User

Vào Firebase Console → Authentication → Add user:
- Email: \`admin@example.com\`
- Password: (tự đặt mật khẩu mạnh)

### 6. Chạy Development

\`\`\`powershell
npm run dev
\`\`\`

Mở http://localhost:5173

## 🚀 Deploy Production

### Vercel (Recommended)

\`\`\`powershell
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables trong Vercel dashboard
# Settings → Environment Variables → thêm tất cả VITE_*
\`\`\`

### Firebase Hosting

\`\`\`powershell
# Build
npm run build

# Deploy
firebase deploy --only hosting
\`\`\`

### Netlify

1. Connect repo trong Netlify dashboard
2. Build command: \`npm run build\`
3. Publish directory: \`dist\`
4. Environment variables: thêm tất cả \`VITE_*\`

## 📂 Cấu trúc thư mục

\`\`\`
src/
├── components/
│   ├── auth/          # AuthGuard
│   ├── layout/        # AdminLayout, PublicLayout
│   └── ui/            # Shadcn components
├── lib/
│   ├── firebase.ts    # Firebase init
│   └── utils.ts       # Helpers
├── pages/
│   ├── admin/         # Admin pages
│   ├── LoginPage.tsx
│   └── ReviewPage.tsx
├── stores/            # Zustand stores
│   ├── auth.ts
│   ├── projects.ts
│   ├── files.ts
│   └── comments.ts
├── types/
│   └── index.ts       # TypeScript types
└── App.tsx            # Router setup
\`\`\`

## 🔒 Security

- **Firestore Rules:** Public read, public comment create, admin-only write
- **Storage Rules:** Public read, admin-only upload, 100MB limit, validate file types
- **Auth:** Chỉ admin được vào \`/app/*\`

⚠️ **Lưu ý:** Public read có nghĩa bất kỳ ai có link review đều xem được. Đảm bảo điều này phù hợp với use case của bạn.

## 🗂️ Data Schema

### Projects
\`\`\`typescript
{
  id: string
  name: string
  createdAt: Timestamp
  status: 'active' | 'archived'
  adminEmail: string
}
\`\`\`

### Files
\`\`\`typescript
{
  id: string
  projectId: string
  name: string
  type: 'image' | 'video' | 'model'
  versions: [{
    url: string
    version: number
    uploadedAt: Timestamp
    metadata: { size, type, width?, height?, duration? }
  }]
  currentVersion: number
}
\`\`\`

### Comments
\`\`\`typescript
{
  id: string
  projectId: string
  fileId: string
  version: number
  userName: string
  content: string
  timestamp: number | null  // seconds for video
  isResolved: boolean
  createdAt: Timestamp
}
\`\`\`

## 🎯 Workflow

1. **Admin:** Tạo project → Upload file
2. **Admin:** Chia sẻ link \`/review/:projectId\` cho client
3. **Client:** Vào link → Nhập tên → Xem file → Comment
4. **Admin:** Xem comment realtime → Resolve → Upload version mới
5. **Client:** Thấy version mới realtime → Comment tiếp

## 🐛 Troubleshooting

### Lỗi Firebase: "Missing or insufficient permissions"
→ Deploy Firestore rules: \`firebase deploy --only firestore:rules\`

### Lỗi CORS khi tải file từ Storage
→ Đảm bảo Storage rules đã deploy

### Index Firestore chưa tạo
→ Khi truy vấn, console sẽ gợi ý link tạo index. Click và đợi vài phút.

### Video MOV không play
→ Chuyển sang MP4 (H.264) bằng FFmpeg:
\`\`\`powershell
ffmpeg -i input.mov -c:v libx264 -c:a aac output.mp4
\`\`\`

## 📝 Roadmap Phase 2

- [ ] Projects CRUD UI hoàn chỉnh
- [ ] File upload với drag & drop
- [ ] Image/Video/3D viewers
- [ ] Comment panel với timestamp
- [ ] Public review với username prompt
- [ ] Version switcher UI
- [ ] Resolve comment toggle
- [ ] Search và filter
- [ ] Export comments PDF
- [ ] Notifications/webhooks

## 📄 License

MIT

---

**Lưu ý quan trọng:** Đây là base setup. Các tính năng viewer và upload sẽ được implement trong các phase tiếp theo. Hiện tại có thể chạy login/logout và routing cơ bản.
