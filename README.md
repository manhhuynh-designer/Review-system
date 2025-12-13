# Creative Asset Review System

A web application for reviewing creative assets (images, videos, image sequences, PDFs, and 3D models) with annotation tools, timestamped comments for videos, and version management.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-FFDD00.svg)](https://coffee.manhhuynh.work)

## ✨ Features

### Admin (Creator)
- 🔐 **Authentication**: Login via Firebase Auth (admin flows are protected).
- 📁 **Project & File Management**: Manage projects and files organized by folders.
- 📤 **Multi-format Support**: Upload images (PNG/JPG/WebP), videos (MP4), PDFs, image sequences, and 3D models (GLB).
- 🔄 **Versioning**: Upload new versions of files and switch between them easily.
- 📌 **Version Badges**: Clear visual indicators for file versions.
- 💬 **Comment Management**: Real-time comments with resolve/unresolve status.
- ✏️ **Annotation Tools**: Draw directly on assets using Pen, Rectangle, Arrow tools with Undo/Redo support.
- 🔗 **Sharing**: Generate public review links or share specific files directly.

### Client (Reviewer)
- 🚫 **No Registration Required**: Public reviewer flow allows access without account creation.
- 👤 **Guest Identity**: Reviewers enter a display name (persisted locally).
- framing **Specialized Viewers**: Dedicated viewers for each file type (Video player with frame-step, PDF viewer, 3D viewer, Image Sequence player).
- 💬 **Feedback**: Leave timestamped comments on videos and general comments on other assets.
- ⚡ **Real-time**: Updates are reflected instantly via Firestore.

## 🛠️ Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS, shadcn/ui
- **State Management:** Zustand
- **Visualization:** 
    - `react-pdf` (PDFs)
    - `react-konva` (Annotations)
    - `react-three-fiber` + `three.js` (3D Models)
    - `@mediamonks/fast-image-sequence` (Image Sequences)
- **Backend:** Firebase (Auth, Firestore, Storage)

## 📦 Quick Start

### Prerequisites
- Node.js (v18+)
- A Firebase project

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Manh-Huynh-Opensource/Review-system.git
    cd Review-system
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Firebase**
    - Create a project in the [Firebase Console](https://console.firebase.google.com/).
    - Enable **Authentication**, **Firestore**, and **Storage**.
    - Copy `.env.example` to `.env` and fill in your Firebase credentials:
    ```bash
    cp .env.example .env
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## 📂 Project Structure

```
src/
├── components/
│   ├── files/               # File management (Upload, List, Dialog)
│   ├── viewers/             # File viewers (PDF, Video, GLB, Sequence)
│   ├── annotations/         # Annotation canvas and tools
│   └── ui/                  # Shared UI components
├── lib/
│   ├── firebase.ts          # Firebase configuration & helpers
│   └── storageUtils.ts      # Utilities
├── pages/
│   └── ReviewPage.tsx       # Public review interface
├── stores/                  # Zustand state management
└── App.tsx
```

## 🔒 Security Note

- The default configuration uses public read access for review links.
- For production use, consider implementing strict Firestore/Storage security rules.
- **Sensitive Data**: Currently, `private: true` prevents accidental npm publishing, but ensure you do not commit `.env` files containing secrets.

## 🤝 Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Mạnh Huỳnh**

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://coffee.manhhuynh.work)
