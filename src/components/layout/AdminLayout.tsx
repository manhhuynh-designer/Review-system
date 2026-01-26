import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/projects'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { AccountSettingsDialog } from '@/components/auth/AccountSettingsDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { LogOut, FolderOpen, ChevronDown, Plus, Users, User, BarChart3, Menu } from 'lucide-react'

import { useEffect, useState } from 'react'

export function AdminLayout() {
  const { user, signOut } = useAuthStore()
  const { projects, subscribeToProjects } = useProjectStore()
  const location = useLocation()
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentProject = projects.find(p => p.id === projectId)
  const isProjectDetail = location.pathname.includes('/projects/') && projectId
  const isProjectsList = location.pathname === '/app/projects'



  // Subscribe to projects when user is available
  useEffect(() => {
    if (user?.email) {

      subscribeToProjects(user.email)
    }
  }, [user?.email, subscribeToProjects])

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const navItems = [
    { path: '/app/dashboard', label: 'Dashboard', icon: BarChart3, active: location.pathname === '/app/dashboard' },
    { path: '/app/projects', label: 'Dự án', icon: FolderOpen, active: isProjectsList || isProjectDetail },
    { path: '/app/clients', label: 'Khách hàng', icon: Users, active: location.pathname === '/app/clients' },
  ]

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Compact Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-3 sm:px-4">
          {/* Left: Logo + Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-9 w-9 p-0"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>

            {/* Logo/Brand */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/app/projects')}
              className="h-9 w-9"
            >
              <img src="/review-system-logo.svg" alt="Review System" className="w-6 h-6" />
            </Button>


            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-2">
              {navItems.map(item => (
                <Button
                  key={item.path}
                  variant={item.active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className="gap-1.5 h-9"
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </Button>
              ))}
            </nav>

            {/* Project Selector (Desktop & Mobile) */}
            {isProjectDetail && (
              <>
                <Separator orientation="vertical" className="h-5 hidden md:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 h-9 max-w-[120px] sm:max-w-[200px]">
                      <FolderOpen className="w-4 h-4 shrink-0" />
                      <span className="truncate text-sm">{currentProject?.name || 'Project'}</span>
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem onClick={() => navigate('/app/projects')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Tất cả dự án
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {projects.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                        Đang tải dự án...
                      </div>
                    ) : (
                      projects.map(project => (
                        <DropdownMenuItem
                          key={project.id}
                          onClick={() => navigate(`/app/projects/${project.id}`)}
                          className={project.id === projectId ? 'bg-accent' : ''}
                        >
                          <FolderOpen className="w-4 h-4 mr-2" />
                          <div className="flex-1">
                            <div className="font-medium truncate">{project.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {project.status}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            {/* User Menu - Hidden on mobile, visible on desktop */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="hidden md:flex gap-1.5 h-9">
                  <User className="h-4 w-4" />
                  <span className="hidden lg:inline max-w-[120px] truncate text-sm">{user?.email}</span>
                  <ChevronDown className="h-3 w-3 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Tài khoản</span>
                    <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2 space-y-1">
                  <AccountSettingsDialog />
                  <ChangePasswordDialog />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Menu Dialog */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="sm:max-w-[340px] p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-base font-medium">Menu</DialogTitle>
          </DialogHeader>

          <div className="p-3">
            {/* Navigation */}
            <nav className="space-y-1 mb-3">
              {navItems.map(item => (
                <Button
                  key={item.path}
                  variant={item.active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    navigate(item.path)
                    setMobileMenuOpen(false)
                  }}
                  className="w-full justify-start gap-2 h-9"
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </Button>
              ))}
            </nav>

            <Separator className="my-3" />

            {/* Theme Toggle */}
            <div className="flex items-center justify-between px-3 py-2 mb-3">
              <span className="text-sm">Giao diện</span>
              <ThemeToggle />
            </div>

            <Separator className="my-3" />

            {/* Account Section */}
            <div className="space-y-2">
              <div className="px-3 py-1">
                <p className="text-xs text-muted-foreground mb-1">Tài khoản</p>
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </div>

              <div className="px-1 space-y-1">
                <AccountSettingsDialog />
                <ChangePasswordDialog />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  signOut()
                  setMobileMenuOpen(false)
                }}
                className="w-full justify-start gap-2 h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Đăng xuất</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  )
}
