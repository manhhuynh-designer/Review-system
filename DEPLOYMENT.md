# 🚀 Deployment Checklist

## ✅ Phase 1: Base Setup (COMPLETED)

- [x] Cài dependencies (Firebase, React Router, Zustand, Tailwind, Shadcn, Three.js)
- [x] Config Tailwind CSS v3 + dark mode
- [x] Setup path alias `@/`
- [x] Tạo Firebase config (`firebase.ts`)
- [x] Tạo `.env.example` template
- [x] Tạo TypeScript types
- [x] Zustand stores: auth, projects, files, comments
- [x] React Router v6 setup
- [x] Auth flows (login, logout, guards)
- [x] Layouts (Admin, Public)
- [x] Shadcn UI components (Button, Input, Label, Dialog, Textarea)
- [x] Firebase rules (Firestore, Storage, indexes)
- [x] Toast notifications (react-hot-toast)
- [x] README documentation
- [x] Build test successful ✅

## 📋 Bạn cần làm ngay (Bắt buộc để chạy)

### 1. Firebase Console Setup
```
[ ] Tạo Firebase Project: https://console.firebase.google.com/
[ ] Bật Authentication → Email/Password
[ ] Tạo Firestore Database (production mode)
[ ] Tạo Storage bucket
[ ] Lấy Web App Config (apiKey, authDomain, projectId, etc.)
```

### 2. Local Config
```
[ ] Điền Firebase config vào file `.env`:
    - VITE_FIREBASE_API_KEY=...
    - VITE_FIREBASE_AUTH_DOMAIN=...
    - VITE_FIREBASE_PROJECT_ID=...
    - VITE_FIREBASE_STORAGE_BUCKET=...
    - VITE_FIREBASE_MESSAGING_SENDER_ID=...
    - VITE_FIREBASE_APP_ID=...
```

### 3. Deploy Firebase Rules
```powershell
# Cài Firebase CLI nếu chưa có
npm install -g firebase-tools

# Login
firebase login

# Init project (chọn Firestore, Storage, Hosting)
firebase init

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes  
firebase deploy --only storage
```

### 4. Tạo Admin User
```
[ ] Firebase Console → Authentication → Add user
    Email: admin@example.com
    Password: (tự đặt mật khẩu mạnh)
```

### 5. Test Local
```powershell
npm run dev
# Vào http://localhost:5173
# Login với admin account
```

## 🎯 Phase 2: Features Implementation (TODO)

### Projects CRUD (Next Priority)
```
[ ] ProjectList component với realtime subscription
[ ] Create project dialog
[ ] Project card với actions (edit, delete, archive)
[ ] Project detail page
[ ] File list trong project
```

### File Upload & Versioning
```
[ ] FileUploader component với drag & drop
[ ] Upload progress indicator
[ ] Version history UI
[ ] Version switcher
[ ] File type detection (image/video/model)
[ ] Metadata extraction (size, dimensions, duration)
```

### Viewers
```
[ ] ImageViewer: zoom, pan, fullscreen
[ ] VideoViewer: custom controls, timeline, seek
[ ] ModelViewer3D: OrbitControls, Stage, lighting
[ ] Responsive layout
```

### Comment System
```
[ ] CommentPanel component
[ ] CommentComposer với username
[ ] Timestamp picker cho video
[ ] Click timestamp → seek video
[ ] Resolve toggle (admin only)
[ ] Realtime updates
[ ] Filter by resolved/unresolved
```

### Public Review
```
[ ] UsernamePromptDialog
[ ] localStorage persistence
[ ] Public route layout
[ ] Minimal viewer UI
[ ] Comment creation (no login)
```

### Polish
```
[ ] Loading states
[ ] Error boundaries
[ ] Skeleton loaders
[ ] Empty states
[ ] Confirmation dialogs
[ ] Keyboard shortcuts
[ ] Dark mode toggle (optional - default dark)
```

## 🚢 Phase 3: Production Deploy

### Vercel (Recommended)
```
[ ] Push code to GitHub
[ ] Connect repo to Vercel
[ ] Set environment variables (all VITE_*)
[ ] Deploy
[ ] Test production URL
```

### Firebase Hosting (Alternative)
```
[ ] npm run build
[ ] firebase deploy --only hosting
[ ] Test production URL
```

### Post-Deploy
```
[ ] Test login flow
[ ] Test project CRUD
[ ] Test file upload
[ ] Test public review link
[ ] Test realtime comments
[ ] Performance audit (Lighthouse)
[ ] Mobile responsiveness test
```

## 📊 Performance Optimization

```
[ ] Code splitting (React.lazy)
[ ] Image optimization (WebP, lazy load)
[ ] Video compression guidelines
[ ] GLB Draco compression
[ ] Bundle size analysis
[ ] Firestore index optimization
[ ] CDN for static assets
```

## 🔒 Security Checklist

```
[ ] Review Firestore rules
[ ] Review Storage rules
[ ] Test unauthorized access
[ ] Validate file uploads (size, type)
[ ] Sanitize user inputs
[ ] Rate limiting (via Firebase/Cloudflare)
[ ] HTTPS only
```

## 📝 Documentation

```
[ ] Update README với screenshots
[ ] API reference (nếu có backend riêng)
[ ] Troubleshooting guide
[ ] Video tutorial (optional)
```

---

## 🎉 Current Status

**Base infrastructure: ✅ DONE**

App có thể:
- ✅ Login/logout với Firebase Auth
- ✅ Route guards (admin-only /app/*)
- ✅ Dark mode by default
- ✅ Toast notifications
- ✅ TypeScript strict mode
- ✅ Build production thành công

**Chạy ngay:**
```powershell
# 1. Điền .env
# 2. Deploy Firebase rules
# 3. Tạo admin user
# 4. npm run dev
```

**Next step:** Implement Projects CRUD hoặc bất kỳ feature nào trong Phase 2.
