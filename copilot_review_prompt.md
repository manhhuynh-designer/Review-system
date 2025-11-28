{
  "projectTitle": "Creative Asset Review Web Application",
  "corePhilosophy": "Minimalism, High Performance, and Dark Mode by default.",
  "actors": {
    "admin": {
      "role": "The Creator",
      "features": [
        "Login via Firebase Auth (Email/Password).",
        "Create 'Projects', view list of projects, manage files, and versioning.",
        "Drag & drop upload for Images (PNG, JPG, WebP), Videos (MP4, MOV), and 3D Models (GLB).",
        "Handle versioning (v1 -> v2 -> v3) for re-uploaded files.",
        "View all client comments in real-time, resolve threads ('isResolved: boolean').",
        "Generate a generic public 'Review Link' (`/review/:projectId`)."
      ]
    },
    "client": {
      "role": "The Reviewer",
      "features": [
        "No Login: Access via shared unique link.",
        "Requires entering a display 'userName' upon first visit (stored in session/localStorage).",
        "High-quality, distraction-free viewer for assets.",
        "Smart Comments: Video comments linked to playback 'timestamp'. Clicking comment seeks video.",
        "Real-time updates via Firestore."
      ]
    }
  },
  "techStack": {
    "framework": "React + Vite + TypeScript (Strict mode)",
    "styling": "Tailwind CSS + clsx + tailwind-merge (Dark mode mandatory)",
    "uiComponents": "Shadcn/UI (mimic styles) or standard HTML/CSS",
    "3dEngine": "react-three-fiber, @react-three/drei (with <Stage>)",
    "stateManagement": "Zustand",
    "routing": "React Router v6 (createBrowserRouter)",
    "backend": "Firebase v9 (Auth, Firestore, Storage)",
    "utils": ["date-fns", "react-hot-toast", "uuid"]
  },
  "dataSchema": {
    "collections": [
      {
        "name": "projects",
        "documentId": "projectId",
        "fields": ["name: string", "createdAt: Timestamp", "status: 'active' | 'archived'", "adminEmail: string"]
      },
      {
        "name": "files",
        "parentCollection": "projects",
        "documentId": "fileId",
        "fields": [
          "name: string",
          "type: 'image' | 'video' | 'model'",
          "versions: Array<{ url: string, version: number, uploadedAt: Timestamp, metadata: { ... } }>",
          "currentVersion: number"
        ]
      },
      {
        "name": "comments",
        "parentCollection": "projects",
        "documentId": "commentId",
        "fields": [
          "fileId: string",
          "version: number",
          "userName: string",
          "content: string",
          "timestamp: number | null",
          "isResolved: boolean (Default false)",
          "createdAt: Timestamp"
        ]
      }
    ]
  },
  "securityRules": {
    "firestore": "Authenticated users are Admins. Public read on all collections. Public create on comments.",
    "storage": "Public read. Only authenticated users (Admins) can write/upload files."
  }
}