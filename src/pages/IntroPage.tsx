
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, GitBranch, Shield, Zap, Globe, Coffee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ParallaxBackground } from '@/components/ui/ParallaxBackground'

type Lang = 'vi' | 'en'

const translations = {
    vi: {
        title: 'Creative Asset Review System',
        subtitle: 'Giải pháp Mã nguồn mở (Open Source) để review hình ảnh, video và 3D. Tối ưu hóa quy trình phản hồi với bình luận theo thời gian, công cụ chú thích và quản lý phiên bản.',
        backToPortfolio: 'Quay lại Portfolio',
        keyFeatures: 'Tính năng Chính',
        footer: '© 2025 Mạnh Huỳnh. Phần mềm Mã nguồn mở.',
        viewOnGithub: 'Xem trên GitHub',
        buyMeACoffee: 'Mời tôi một ly cà phê',
        features: [
            {
                title: 'Hỗ trợ Đa định dạng',
                desc: 'Xem và review Ảnh, Video, PDF, Image Sequences, và Mô hình 3D (GLB) trên cùng một nền tảng.'
            },
            {
                title: 'Chú thích Tức thì',
                desc: 'Vẽ trực tiếp lên file. Công cụ Hình chữ nhật, Bút, Mũi tên với khả năng Undo/Redo.'
            },
            {
                title: 'Quản lý Phiên bản',
                desc: 'Theo dõi lịch sử chỉnh sửa. Dễ dàng tải lên phiên bản mới và chuyển đổi giữa các version.'
            },
            {
                title: 'Review Bảo mật',
                desc: 'Dự án do Admin quản lý. Tạo link review công khai cho khách hàng mà không cần đăng ký.'
            },
            {
                title: 'Mã nguồn mở',
                desc: 'Giấy phép MIT. Xây dựng hiện đại với React, Vite, Firebase, và Tailwind CSS.'
            },
            {
                title: 'Bình luận Video',
                desc: 'Bình luận chính xác theo từng frame (thời gian thực) để phản hồi chi tiết nhất.'
            }
        ]
    },
    en: {
        title: 'Creative Asset Review System',
        subtitle: 'Open Source solution for reviewing creative assets. Streamline your feedback loop with timestamped comments, annotations, and version control.',
        backToPortfolio: 'Back to Portfolio',
        keyFeatures: 'Key Features',
        footer: '© 2025 Mạnh Huỳnh. Open Source Software.',
        viewOnGithub: 'View on GitHub',
        buyMeACoffee: 'Buy me a coffee',
        features: [
            {
                title: 'Multi-Format Support',
                desc: 'Review Images, Videos, PDFs, Image Sequences, and 3D GLB models in one place.'
            },
            {
                title: 'Real-time Annotations',
                desc: 'Draw directly on assets. Rectangle, Pen, Arrow tools with undo/redo capabilities.'
            },
            {
                title: 'Version Control',
                desc: 'Keep track of asset iterations. Upload new versions and switch between them effortlessly.'
            },
            {
                title: 'Secure Reviews',
                desc: 'Admin-managed projects. Public review links for clients without registration.'
            },
            {
                title: 'Open Source',
                desc: 'MIT Licensed. Built with React, Vite, Firebase, and Tailwind CSS.'
            },
            {
                title: 'Video Comments',
                desc: 'Frame-accurate timestamped comments for precise video feedback.'
            }
        ]
    }
}

const icons = [
    <CheckCircle2 className="w-6 h-6 text-green-500" key="1" />,
    <Zap className="w-6 h-6 text-yellow-500" key="2" />,
    <GitBranch className="w-6 h-6 text-blue-500" key="3" />,
    <Shield className="w-6 h-6 text-purple-500" key="4" />,
    <GitBranch className="w-6 h-6 text-orange-500" key="5" />,
    <Zap className="w-6 h-6 text-cyan-500" key="6" />
]

export default function IntroPage() {
    const [lang, setLang] = useState<Lang>('vi')
    const t = translations[lang]

    const toggleLang = () => setLang(prev => prev === 'vi' ? 'en' : 'vi')

    return (
        <div className="min-h-screen bg-background/50 text-foreground flex flex-col font-sans relative overflow-hidden">
            <ParallaxBackground />

            {/* Language Switcher */}
            <div className="absolute top-6 right-6 z-20">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleLang}
                    className="flex items-center gap-2 rounded-full backdrop-blur-sm bg-background/50"
                >
                    <Globe className="w-4 h-4" />
                    <span className="font-semibold w-6 text-center">{lang.toUpperCase()}</span>
                </Button>
            </div>

            {/* Hero Section */}
            <header className="py-20 px-6 md:px-12 text-center max-w-5xl mx-auto space-y-6 relative z-10">
                <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
                    <Zap className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
                    {t.title}
                </h1>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {t.subtitle}
                </p>

                <div className="pt-8 flex justify-center">
                    <a
                        href="https://manhhuynh.work"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        {t.backToPortfolio}
                    </a>
                </div>
            </header>

            {/* Features Grid */}
            <main className="flex-1 bg-secondary/30 backdrop-blur-sm py-16 px-6 md:px-12 relative z-10">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-12">{t.keyFeatures}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {t.features.map((feature, index) => (
                            <FeatureCard
                                key={index}
                                icon={icons[index]}
                                title={feature.title}
                                desc={feature.desc}
                            />
                        ))}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border relative z-10 bg-background/80 backdrop-blur-lg">
                <p>{t.footer}</p>
                <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                    <a
                        href="https://github.com/Manh-Huynh-Opensource/Review-system"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-primary transition-colors flex items-center gap-2"
                    >
                        <GitBranch className="w-4 h-4" />
                        {t.viewOnGithub}
                    </a>
                    <a
                        href="https://coffee.manhhuynh.work"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:scale-105 transition-transform flex items-center gap-2 font-medium text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-full border border-amber-200 dark:border-amber-800"
                    >
                        <Coffee className="w-4 h-4" />
                        {t.buyMeACoffee}
                    </a>
                </div>
            </footer>
        </div>
    )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4">{icon}</div>
            <h3 className="text-lg font-bold mb-2">{title}</h3>
            <p className="text-muted-foreground">{desc}</p>
        </div>
    )
}

