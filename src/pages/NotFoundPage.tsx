import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft, Search, Ghost } from 'lucide-react'

export default function NotFoundPage() {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
            <div className="max-w-lg w-full text-center space-y-8">
                {/* Animated Ghost Icon */}
                <div className="relative">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center animate-pulse">
                        <Ghost className="w-16 h-16 text-primary/60" />
                    </div>
                    {/* Floating particles */}
                    <div className="absolute top-4 left-1/4 w-2 h-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="absolute top-8 right-1/4 w-3 h-3 rounded-full bg-primary/20 animate-bounce" style={{ animationDelay: '0.3s' }} />
                    <div className="absolute bottom-4 left-1/3 w-2 h-2 rounded-full bg-primary/25 animate-bounce" style={{ animationDelay: '0.5s' }} />
                </div>

                {/* 404 Text */}
                <div className="space-y-4">
                    <h1 className="text-8xl font-black bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                        404
                    </h1>
                    <h2 className="text-2xl font-bold text-foreground">
                        Trang không tồn tại
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
                        Hãy thử quay lại trang trước hoặc về trang chủ.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                        variant="default"
                        size="lg"
                        className="gap-2 min-w-[160px]"
                        onClick={() => navigate('/')}
                    >
                        <Home className="w-4 h-4" />
                        Trang chủ
                    </Button>

                    <Button
                        variant="outline"
                        size="lg"
                        className="gap-2 min-w-[160px]"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </Button>
                </div>

                {/* Helpful Links */}
                <div className="pt-8 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-4">Hoặc thử các liên kết sau:</p>
                    <div className="flex flex-wrap justify-center gap-4 text-sm">
                        <a
                            href="/app/dashboard"
                            className="text-primary hover:underline flex items-center gap-1"
                        >
                            <Search className="w-3 h-3" />
                            Dashboard
                        </a>
                        <span className="text-muted-foreground">•</span>
                        <a
                            href="/app/projects"
                            className="text-primary hover:underline"
                        >
                            Dự án
                        </a>
                        <span className="text-muted-foreground">•</span>
                        <a
                            href="/usage"
                            className="text-primary hover:underline"
                        >
                            Hướng dẫn
                        </a>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-xs text-muted-foreground/60">
                    Mã lỗi: 404 | Not Found
                </p>
            </div>
        </div>
    )
}
