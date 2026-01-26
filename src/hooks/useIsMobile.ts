import { useState, useEffect } from 'react'

/**
 * Hook to detect mobile viewport
 * @param breakpoint - Max width in pixels to consider as mobile (default: 640px = Tailwind 'sm')
 */
export function useIsMobile(breakpoint = 640) {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        // Check if window is available (SSR safety)
        if (typeof window === 'undefined') return

        const mql = window.matchMedia(`(max-width: ${breakpoint}px)`)
        setIsMobile(mql.matches)

        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mql.addEventListener('change', handler)

        return () => mql.removeEventListener('change', handler)
    }, [breakpoint])

    return isMobile
}
