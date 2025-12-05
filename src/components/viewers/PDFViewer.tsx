import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
const workerUrl = '/pdf.worker.min.mjs'

console.log('🔧 Initializing PDF worker with URL:', workerUrl)

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

interface PDFViewerProps {
    url: string
    currentPage?: number
    onPageChange?: (page: number) => void
    className?: string
    children?: React.ReactNode
}

export function PDFViewer({
    url,
    currentPage = 1,
    onPageChange,
    className = '',
    children
}: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0)
    const [pageNumber, setPageNumber] = useState<number>(currentPage)
    const [scale, setScale] = useState<number>(1)
    const [rotation, setRotation] = useState<number>(0)
    const [error, setError] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState<number>(0)
    const [viewMode, setViewMode] = useState<'scroll' | 'single' | 'double'>('scroll')
    const [backgroundColor] = useState<string>('bg-muted/20')
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Pan state
    const [isDragging, setIsDragging] = useState(false)
    const [startPos, setStartPos] = useState({ x: 0, y: 0 })
    const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 })

    // Update page when prop changes
    useEffect(() => {
        if (currentPage !== pageNumber) {
            setPageNumber(currentPage)
        }
    }, [currentPage])

    // Measure container width for responsive scaling
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth)
            }
        }

        updateWidth()
        const resizeObserver = new ResizeObserver(updateWidth)
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current)
        }

        return () => resizeObserver.disconnect()
    }, [])

    // Handle fullscreen change events
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    // Intersection Observer to update page number on scroll
    useEffect(() => {
        if (viewMode !== 'scroll' || !numPages) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '1')
                        setPageNumber(pageNum)
                        onPageChange?.(pageNum)
                    }
                })
            },
            {
                root: containerRef.current,
                threshold: 0.5 // Trigger when 50% of page is visible
            }
        )

        // Observe all pages
        for (let i = 1; i <= numPages; i++) {
            const element = document.getElementById(`pdf-page-${i}`)
            if (element) observer.observe(element)
        }

        return () => observer.disconnect()
    }, [numPages, viewMode])

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`)
            })
        } else {
            document.exitFullscreen()
        }
    }, [])

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages)
        setError(null)
    }, [])

    const onDocumentLoadError = useCallback((err: Error) => {
        console.error('❌ PDF load error:', err)
        setError(`Không thể tải file PDF: ${err.message}`)
    }, [])

    const changePage = useCallback((offset: number) => {
        const newPage = Math.min(Math.max(1, pageNumber + offset), numPages)
        setPageNumber(newPage)
        onPageChange?.(newPage)

        // Scroll to page in scroll mode
        if (viewMode === 'scroll') {
            const pageElement = document.getElementById(`pdf-page-${newPage}`)
            if (pageElement) {
                pageElement.scrollIntoView({ behavior: 'smooth' })
            }
        }
    }, [pageNumber, numPages, onPageChange, viewMode])



    const zoomIn = () => setScale(s => Math.min(3, s + 0.25))
    const zoomOut = () => setScale(s => Math.max(0.5, s - 0.25))
    const rotate = () => setRotation(r => (r + 90) % 360)

    // Pan handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return
        setIsDragging(true)
        setStartPos({ x: e.clientX, y: e.clientY })
        setScrollPos({
            left: containerRef.current.scrollLeft,
            top: containerRef.current.scrollTop
        })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !containerRef.current) return
        e.preventDefault()

        const dx = e.clientX - startPos.x
        const dy = e.clientY - startPos.y

        containerRef.current.scrollLeft = scrollPos.left - dx
        containerRef.current.scrollTop = scrollPos.top - dy
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    // Calculate responsive width based on layout
    const getPageWidth = () => {
        if (containerWidth <= 0) return undefined
        const padding = 32
        const availableWidth = containerWidth - padding

        if (viewMode === 'double') return (availableWidth / 2) * scale
        if (viewMode === 'single') return Math.min(availableWidth, 1200) * scale
        return Math.min(availableWidth, 1000) * scale // Wider for scroll mode
    }

    const pageWidth = getPageWidth()

    // Determine pages to render based on layout
    const getPagesToRender = () => {
        if (viewMode === 'scroll') {
            // Render ALL pages for continuous scroll
            return Array.from({ length: numPages }, (_, i) => i + 1)
        }
        if (viewMode === 'double') {
            // Render current and next page
            return [pageNumber, pageNumber + 1].filter(p => p <= numPages)
        }
        // Single page view
        return [pageNumber]
    }

    const pagesToRender = getPagesToRender()

    return (
        <div className={`flex flex-col h-full w-full ${className} ${isFullscreen ? 'bg-background' : ''}`}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-background/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-20 shadow-sm">

                {/* Left: View Modes */}
                <div className="flex items-center bg-muted/50 rounded-lg p-1">
                    <Button
                        variant={viewMode === 'scroll' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setViewMode('scroll')}
                        title="Cuộn dọc tất cả trang"
                    >
                        <div className="flex flex-col gap-0.5"><div className="w-3 h-1.5 border border-current rounded-[1px]" /><div className="w-3 h-1.5 border border-current rounded-[1px]" /></div>
                        Cuộn
                    </Button>
                    <Button
                        variant={viewMode === 'single' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setViewMode('single')}
                        title="Xem từng trang"
                    >
                        <div className="w-3 h-4 border border-current rounded-[1px]" />
                        Trang
                    </Button>
                    <Button
                        variant={viewMode === 'double' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setViewMode('double')}
                        title="Xem 2 trang song song"
                    >
                        <div className="flex gap-0.5"><div className="w-2 h-3 border border-current rounded-[1px]" /><div className="w-2 h-3 border border-current rounded-[1px]" /></div>
                        Trang đôi
                    </Button>
                </div>

                {/* Center: Page Navigation */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => changePage(viewMode === 'double' ? -2 : -1)}
                        disabled={pageNumber <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-1 text-sm px-2 min-w-[80px] justify-center font-medium">
                        <span>{pageNumber}</span>
                        {viewMode === 'double' && pageNumber + 1 <= numPages && <span>-{pageNumber + 1}</span>}
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{numPages || '-'}</span>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => changePage(viewMode === 'double' ? 2 : 1)}
                        disabled={pageNumber >= numPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Right: Tools */}
                <div className="flex items-center gap-2">
                    {/* Zoom */}
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={scale <= 0.5}>
                            <ZoomOut className="h-3 w-3" />
                        </Button>
                        <span className="text-xs w-8 text-center hidden sm:inline-block">{Math.round(scale * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={scale >= 3}>
                            <ZoomIn className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* Rotate & Fullscreen (Desktop only for rotate) */}
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hidden sm:flex" onClick={rotate} title="Xoay">
                            <RotateCw className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFullscreen} title="Toàn màn hình">
                            <Maximize2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* PDF Content */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-auto ${backgroundColor} relative cursor-${isDragging ? 'grabbing' : 'grab'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {error ? (
                    <div className="flex items-center justify-center h-full text-destructive">
                        <div className="text-center">
                            <div className="text-4xl mb-2">📄</div>
                            <div>{error}</div>
                        </div>
                    </div>
                ) : (
                    <div className={`min-h-full flex w-fit mx-auto p-4 ${viewMode === 'scroll' ? 'flex-col items-center gap-4' : viewMode === 'double' ? 'flex-row items-center gap-0 my-auto' : 'items-center my-auto'}`}>
                        <Document
                            file={url}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={
                                <div className="flex items-center justify-center h-64">
                                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                                </div>
                            }
                            className={`flex justify-center ${viewMode === 'scroll' ? 'flex-col items-center gap-4' : viewMode === 'double' ? 'flex-row items-center gap-0 shadow-2xl' : 'flex-wrap items-start gap-4'}`}
                        >
                            {pagesToRender.map((pageNum, index) => (
                                <div
                                    key={pageNum}
                                    id={`pdf-page-${pageNum}`}
                                    data-page-number={pageNum}
                                    className={`relative group transition-shadow ${viewMode === 'double' ? 'bg-white' : 'hover:shadow-xl'}`}
                                    style={{ zIndex: numPages - index }}
                                >
                                    <Page
                                        pageNumber={pageNum}
                                        width={pageWidth}
                                        rotate={rotation}
                                        loading={
                                            <div className="flex items-center justify-center h-64 w-full bg-background/50">
                                                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                                            </div>
                                        }
                                        className={`bg-white ${viewMode === 'double' ? '' : 'shadow-lg'}`}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                        scale={scale}
                                    >
                                        {/* Annotations only on active page to prevent clutter/perf issues */}
                                        {pageNum === pageNumber && (
                                            <div className="absolute inset-0 z-10">
                                                {children}
                                            </div>
                                        )}
                                    </Page>
                                    {viewMode === 'scroll' && (
                                        <div className="absolute top-2 right-[-40px] hidden xl:flex items-center justify-center w-8 h-8 bg-black/50 text-white text-xs rounded-full">
                                            {pageNum}
                                        </div>
                                    )}
                                    {/* Page number overlay for non-scroll modes */}
                                    {viewMode !== 'scroll' && (
                                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                            {pageNum}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </Document>
                    </div>
                )}
            </div>
        </div>
    )
}

export type { PDFViewerProps }
