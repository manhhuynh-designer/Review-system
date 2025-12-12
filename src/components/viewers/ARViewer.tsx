/// <reference path="../../global.d.ts" />
import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'

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

    useImperativeHandle(ref, () => ({
        activateAR: () => {
            if (modelViewerRef.current) {
                // @ts-ignore - activateAR is a method on the custom element
                modelViewerRef.current.activateAR()
            }
        }
    }))

    // Register the custom element if it hasn't been registered yet
    // Note: This is usually handled by the import '@google/model-viewer', but good to be aware
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
                src={url}
                ios-src={iosSrc}
                alt={alt}
                ar
                ar-modes="scene-viewer webxr quick-look"
                camera-controls
                ar-scale="auto"
                style={{ width: '1px', height: '1px' }}
            >
                {/* @ts-ignore */}
            </model-viewer>
        </div>
    )
})

ARViewer.displayName = 'ARViewer'
