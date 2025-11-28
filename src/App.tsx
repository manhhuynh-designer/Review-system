import { useEffect } from 'react'
import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/auth'

// Layouts
import { AdminLayout } from './components/layout/AdminLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { AuthGuard } from './components/auth/AuthGuard'

// Pages
import LoginPage from './pages/LoginPage'
import ProjectsPage from './pages/admin/ProjectsPage'
import ProjectDetailPage from './pages/admin/ProjectDetailPage'
import ReviewPage from './pages/ReviewPage'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/app',
    element: <AuthGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/app/projects" replace />,
          },
          {
            path: 'projects',
            element: <ProjectsPage />,
          },
          {
            path: 'projects/:projectId',
            element: <ProjectDetailPage />,
          },
        ],
      },
    ],
  },
  {
    path: '/review/:projectId',
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <ReviewPage />,
      },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
])

function App() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    // Set dark mode by default
    document.documentElement.classList.add('dark')
    
    // Initialize auth listener
    const unsubscribe = initialize()
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [initialize])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
    </>
  )
}

export default App

