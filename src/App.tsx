import { useEffect, lazy, Suspense } from 'react'
import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'

// Layouts (not lazy - needed immediately)
import { AdminLayout } from './components/layout/AdminLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { AuthGuard } from './components/auth/AuthGuard'

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const ProjectsPage = lazy(() => import('./pages/admin/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('./pages/admin/ProjectDetailPage'))
const ClientsPage = lazy(() => import('./pages/admin/ClientsPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const IntroPage = lazy(() => import('./pages/IntroPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const InstallationPage = lazy(() => import('./pages/InstallationPage'))
const UsagePage = lazy(() => import('./pages/UsagePage'))
const ServicesPage = lazy(() => import('./pages/ServicesPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Loading component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="text-muted-foreground">Đang tải...</p>
    </div>
  </div>
)

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
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
            element: <Navigate to="/app/dashboard" replace />,
          },
          {
            path: 'dashboard',
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: 'projects',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ProjectsPage />
              </Suspense>
            ),
          },
          {
            path: 'clients',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ClientsPage />
              </Suspense>
            ),
          },
          {
            path: 'projects/:projectId',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ProjectDetailPage />
              </Suspense>
            ),
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
        element: (
          <Suspense fallback={<PageLoader />}>
            <ReviewPage />
          </Suspense>
        ),
      },
      {
        path: 'file/:fileId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ReviewPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/share/p/:projectId',
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <ReviewPage />
          </Suspense>
        ),
      },
      {
        path: 'file/:fileId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ReviewPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/',
    element: (
      <Suspense fallback={<PageLoader />}>
        <IntroPage />
      </Suspense>
    ),
  },
  {
    path: '/privacy',
    element: (
      <Suspense fallback={<PageLoader />}>
        <PrivacyPolicyPage />
      </Suspense>
    ),
  },
  {
    path: '/terms',
    element: (
      <Suspense fallback={<PageLoader />}>
        <TermsOfServicePage />
      </Suspense>
    ),
  },
  {
    path: '/installation',
    element: (
      <Suspense fallback={<PageLoader />}>
        <InstallationPage />
      </Suspense>
    ),
  },
  {
    path: '/usage',
    element: (
      <Suspense fallback={<PageLoader />}>
        <UsagePage />
      </Suspense>
    ),
  },
  {
    path: '/services',
    element: (
      <Suspense fallback={<PageLoader />}>
        <ServicesPage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<PageLoader />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
])

function App() {
  const initialize = useAuthStore((state) => state.initialize)
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    // Initialize theme from localStorage or default to dark
    setTheme(theme)

    // Initialize auth listener
    const unsubscribe = initialize()
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [initialize, setTheme, theme])

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

