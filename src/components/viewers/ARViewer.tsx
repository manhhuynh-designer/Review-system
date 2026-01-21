/// <reference path="../../global.d.ts" />
import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react'

export interface ARViewerRef {
    activateAR: () => void
}

interface ARViewerProps {
    url: string
    iosSrc?: string // Optional USDZ source for iOS
    alt?: string
}

/**
 * ARViewer Component
 * Wraps @google/model-viewer to provide native AR capabilities (AR Quick Look / Scene Viewer)
 * This component remains hidden and is only used to trigger the AR session.
 */
export const ARViewer = forwardRef<ARViewerRef, ARViewerProps>(({ url, iosSrc, alt = "3D Model" }, ref) => {
    const modelViewerRef = useRef<HTMLElement>(null)
    const [arUrl, setArUrl] = useState<string | undefined>(undefined)

    useImperativeHandle(ref, () => ({
        activateAR: () => {
            // 1. Set the URL to trigger loading
            setArUrl(url)

            // 2. Wait for a tick to allow the element to update, then activate
            setTimeout(() => {
                if (modelViewerRef.current) {
                    // @ts-ignore - activateAR is a method on the custom element
                    modelViewerRef.current.activateAR()
                }
            }, 100)
        }
    }))

    // Register the custom element if it hasn't been registered yet
    useEffect(() => {
        import('@google/model-viewer').catch(console.error)
    }, [])

    return (
        <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none opacity-0" aria-hidden="true">
            {/* 
        @ts-ignore - custom element type definition 
        Style with display: block but 0 dimensions/opacity to ensure it's "rendered" for activation but invisible
      */}
            {/* @ts-ignore */}
            <model-viewer
                ref={modelViewerRef}
                src={arUrl}
                ios-src={iosSrc}
                alt={alt}
                ar
                ar-modes="scene-viewer webxr quick-look"
                camera-controls
                ar-scale="auto"
                shadow-intensity="0" // Disable shadows to save memory
                environment-image="neutral" // Use basic lighting to save memory
                loading="eager" // Load immediately once src is set (which is only on click now)
                style={{ width: '1px', height: '1px' }}
            >
                {/* @ts-ignore */}
            </model-viewer>
        </div>
    )
})

ARViewer.displayName = 'ARViewer'
