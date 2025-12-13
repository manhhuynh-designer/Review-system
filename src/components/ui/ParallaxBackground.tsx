
import { useEffect, useRef } from 'react'
import { Circle, Square, Triangle, Hexagon, Star } from 'lucide-react'

export function ParallaxBackground() {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return

            // Normalize coordinates from -1 to 1
            const x = (e.clientX / window.innerWidth) * 2 - 1
            const y = (e.clientY / window.innerHeight) * 2 - 1

            containerRef.current.style.setProperty('--mouse-x', x.toString())
            containerRef.current.style.setProperty('--mouse-y', y.toString())
        }

        window.addEventListener('mousemove', handleMouseMove)
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [])

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden text-primary/10"
            style={{ '--mouse-x': '0', '--mouse-y': '0' } as React.CSSProperties}
        >
            {/* Layer 1 - Slow movement (Deep background) */}
            <div className="absolute inset-0 transition-transform duration-100 ease-out will-change-transform"
                style={{ transform: 'translate(calc(var(--mouse-x) * 20px), calc(var(--mouse-y) * 20px))' }}>

                <Circle className="absolute top-[10%] left-[10%] w-32 h-32 opacity-30" />
                <Square className="absolute top-[50%] right-[15%] w-24 h-24 opacity-30 rotate-12" />
                <Triangle className="absolute bottom-[20%] left-[20%] w-40 h-40 opacity-20 -rotate-12" />
            </div>

            {/* Layer 2 - Medium movement */}
            <div className="absolute inset-0 transition-transform duration-100 ease-out will-change-transform"
                style={{ transform: 'translate(calc(var(--mouse-x) * -40px), calc(var(--mouse-y) * -40px))' }}>

                <Hexagon className="absolute top-[30%] right-[30%] w-16 h-16 opacity-40 rotate-45" />
                <Star className="absolute bottom-[10%] left-[40%] w-12 h-12 opacity-40" />
                <div className="absolute top-[15%] left-[60%] w-4 h-4 rounded-full bg-current opacity-50" />
                <div className="absolute bottom-[40%] right-[10%] w-6 h-6 rounded bg-current opacity-50 rotate-12" />
            </div>

            {/* Layer 3 - Fast movement (Foreground-ish) */}
            <div className="absolute inset-0 transition-transform duration-100 ease-out will-change-transform"
                style={{ transform: 'translate(calc(var(--mouse-x) * 60px), calc(var(--mouse-y) * 60px))' }}>

                <div className="absolute top-[40%] left-[15%] w-2 h-2 rounded-full bg-primary opacity-40" />
                <div className="absolute top-[60%] right-[40%] w-3 h-3 rounded-full border border-primary opacity-40" />
                <div className="absolute bottom-[15%] right-[25%] w-2 h-2 rounded-full bg-primary opacity-40" />
            </div>

            {/* Gradient Blobs */}
            {/* Noise Overlay for Dithering (Fixes banding) */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
                }}
            />

            {/* Top Left - Primary Glow */}
            <div
                className="absolute top-[-10%] left-[-10%] w-[700px] h-[700px] rounded-full blur-[120px]
                           mix-blend-multiply dark:mix-blend-screen opacity-20 dark:opacity-20
                           bg-[radial-gradient(circle,hsl(var(--primary)/0.4)_0%,transparent_70%)]
                           dark:bg-[radial-gradient(circle,hsl(var(--primary)/0.3)_0%,transparent_70%)]"
            />

            {/* Bottom Right - Blue Accent */}
            <div
                className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px]
                           mix-blend-multiply dark:mix-blend-screen opacity-20 dark:opacity-20
                           bg-[radial-gradient(circle,hsl(217,91%,60%,0.4)_0%,transparent_70%)]
                           dark:bg-[radial-gradient(circle,hsl(217,91%,60%,0.3)_0%,transparent_70%)]"
            />

            {/* Mid Right - Purple Accent */}
            <div
                className="absolute top-[40%] right-[20%] w-[500px] h-[500px] rounded-full blur-[100px]
                           mix-blend-multiply dark:mix-blend-screen opacity-20 dark:opacity-20
                           bg-[radial-gradient(circle,hsl(270,95%,60%,0.4)_0%,transparent_70%)]
                           dark:bg-[radial-gradient(circle,hsl(270,95%,60%,0.3)_0%,transparent_70%)]"
            />
        </div>
    )
}
