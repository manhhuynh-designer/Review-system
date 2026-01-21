import { useState, useRef, Suspense, forwardRef, useImperativeHandle, useLayoutEffect, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Html, useGLTF, Center, useMatcapTexture, useAnimations, useProgress } from '@react-three/drei'
import { Button } from '@/components/ui/button'
import { Rotate3d, Box, Sun, Moon, RefreshCcw, Lightbulb, Camera, Circle, Film, Play, Pause, Hand, Move, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as THREE from 'three'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Slider } from '@/components/ui/slider'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { ColorAdjustment } from './effects/ColorAdjustment'



export interface GLBViewerRef {
  getCameraState: () => { position: [number, number, number], target: [number, number, number] } | null
  setCameraState: (state: { position: [number, number, number], target: [number, number, number] }) => void
  captureScreenshot: () => string | null
}

interface GLBViewerProps {
  url: string
  autoRotate?: boolean
  className?: string
  initialCameraState?: { position: [number, number, number], target: [number, number, number] }
  showMobileToolbar?: boolean
  // New props
  isAdmin?: boolean
  initialRenderSettings?: {
    toneMapping?: string
    exposure?: number
    enablePostProcessing?: boolean
    bloomIntensity?: number
    envPreset?: string
    envIntensity?: number
    lightIntensity?: number
    gamma?: number
  }
  onSaveSettings?: (settings: any) => Promise<void>
}

type RenderMode = 'standard' | 'wireframe' | 'matcap'
type MatcapType = 'clay' | 'metal' | 'ceramic' | 'plastic'

const MATCAP_TEXTURES: Record<MatcapType, string> = {
  clay: 'C1AA92_AD6E29_737889_CED1D7',      // Standard clay (brownish-grey)
  metal: '3B3C3F_DAD9D5_929290_ABACA8',    // Gray metal - verified working
  ceramic: 'E6E6E6_AAAAAA_C4C4C4_CCCCCC',  // White ceramic
  plastic: '36C8FA_176ACB_24A7EF_1D93EC'   // Blue plastic
}

// Loading progress component inside Canvas
function Loader() {
  const { progress, active } = useProgress()
  const [visible, setVisible] = useState(false)
  const [displayProgress, setDisplayProgress] = useState(0)

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (active) {
      setVisible(true)
    } else {
      // Delay hiding to bridge gaps between sequential loads (e.g., GLB -> Draco)
      timeout = setTimeout(() => {
        setVisible(false)
        setDisplayProgress(0) // Reset only when fully hidden
      }, 500)
    }
    return () => clearTimeout(timeout)
  }, [active])

  // Update display progress only if increasing (prevent 100% -> 0% glitches)
  useEffect(() => {
    if (visible && progress > displayProgress) {
      setDisplayProgress(progress)
    }
  }, [progress, visible, displayProgress])

  if (!visible) return null

  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 bg-background/90 backdrop-blur px-6 py-4 rounded-lg shadow-lg border min-w-[200px]">
        <div className="text-sm font-medium text-foreground">Đang tải mô hình...</div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground">{displayProgress.toFixed(0)}%</div>
      </div>
    </Html>
  )
}

function Model({
  url,
  renderMode,
  matcapType,
  onCamerasDetected,
  onAnimationsDetected,
  isPlaying,
  selectedAnimation
}: {
  url: string
  renderMode: RenderMode
  matcapType: MatcapType
  onCamerasDetected?: (cameras: THREE.Camera[]) => void
  onAnimationsDetected?: (clips: string[]) => void
  isPlaying?: boolean
  selectedAnimation?: string | null
}) {
  // Enable Draco for compressed meshes (Using CDN for stability)
  const gltf = useGLTF(url, true)
  const [matcapTexture] = useMatcapTexture(MATCAP_TEXTURES[matcapType], 256)
  const group = useRef<THREE.Group>(null)

  // Extract animations
  const { actions, names } = useAnimations(gltf.animations, group)

  // Notify parent about detected animations
  useEffect(() => {
    if (onAnimationsDetected && names.length > 0) {
      onAnimationsDetected(names)
    }
  }, [names, onAnimationsDetected])

  // Handle animation playback
  useEffect(() => {
    // Stop all actions if no animation is selected
    if (!selectedAnimation) {
      Object.values(actions).forEach(action => action?.fadeOut(0.5))
      return
    }

    const action = actions[selectedAnimation]
    if (!action) return

    // Fade into the new animation
    action
      .reset()
      .fadeIn(0.5)
      .play()

    // Sync play/pause state
    action.paused = !isPlaying

    return () => {
      action?.fadeOut(0.5)
    }
  }, [selectedAnimation, isPlaying, actions])

  // Store original materials on first render, before any modifications
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map())
  const materialsInitialized = useRef(false)

  // Store original materials in a separate effect (not during render)
  useEffect(() => {
    if (!materialsInitialized.current && gltf.scene) {
      gltf.scene.traverse((child: any) => {
        if (child.isMesh && !originalMaterials.current.has(child.uuid)) {
          originalMaterials.current.set(child.uuid, child.material)
        }
      })
      materialsInitialized.current = true
    }
  }, [gltf.scene])

  // Detect cameras in a separate effect
  useEffect(() => {
    if (onCamerasDetected && gltf.cameras && gltf.cameras.length > 0) {
      onCamerasDetected(gltf.cameras)
    }
  }, [gltf.cameras, onCamerasDetected])

  useLayoutEffect(() => {
    gltf.scene.traverse((child: any) => {
      if (child.isMesh) {
        const origMat = originalMaterials.current.get(child.uuid)

        if (renderMode === 'wireframe') {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.5
          })
        } else if (renderMode === 'matcap') {
          if (matcapType === 'clay') {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x808080,
              roughness: 0.5,
              metalness: 0
            })
          } else {
            child.material = new THREE.MeshMatcapMaterial({
              matcap: matcapTexture
            })
          }
        } else {
          // Restore original material - keeps all textures, alpha, emission intact
          if (origMat) {
            child.material = origMat
          }
        }

        // Force material update and handle transmission materials
        if (child.material) {
          child.material.needsUpdate = true

          // Ensure correct colorSpace for textures
          const mat = child.material
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace
          if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace

        }
      }
    })
  }, [gltf.scene, renderMode, matcapType, matcapTexture])

  return (
    <Center>
      <group ref={group}>
        <primitive object={gltf.scene} />
      </group>
    </Center>
  )
}

const SceneContent = forwardRef<GLBViewerRef, {
  url: string
  autoRotate: boolean
  renderMode: RenderMode
  matcapType: MatcapType
  envPreset: string
  envIntensity: number
  lightIntensity: number
  selectedCamera: string | null
  fileCameras: THREE.Camera[]
  onCamerasDetected: (cameras: THREE.Camera[]) => void
  initialCameraState?: { position: [number, number, number], target: [number, number, number] }
  onAnimationsDetected?: (clips: string[]) => void
  isPlaying?: boolean
  selectedAnimation?: string | null
  enableBloom: boolean
  bloomIntensity: number
  interactionMode?: 'rotate' | 'pan'
  exposure: number
  gamma: number
}>((props, ref) => {
  const { camera, gl } = useThree()

  // We don't manually apply tone mapping to gl here when using EffectComposer
  // The ToneMapping effect in EffectComposer will handle it.
  // However, we might want to set it for the initial render or fallback.
  // But since EffectComposer disables it, we should trust the Effect.


  // Debug logging to verify parameters are reaching SceneContent
  useEffect(() => {
    // console.log('SceneContent Settings:', {
    //   exposure: props.exposure,
    //   gamma: props.gamma,
    //   glToneMapping: gl.toneMapping
    // })
  }, [props.exposure, props.gamma, gl])

  // Removed useFrame exposure force to avoid conflict with EffectComposer

  const controlsRef = useRef<any>(null)
  const appliedCameraRef = useRef<string | null>(null)

  // Apply initial camera state if provided
  useLayoutEffect(() => {
    if (props.initialCameraState && controlsRef.current) {
      camera.position.set(...props.initialCameraState.position)
      controlsRef.current.target.set(...props.initialCameraState.target)
      controlsRef.current.update()
    }
  }, [props.initialCameraState, camera])

  // Apply file camera when selected
  useLayoutEffect(() => {
    if (props.selectedCamera && props.selectedCamera !== 'default' && appliedCameraRef.current !== props.selectedCamera) {
      const cameraIndex = parseInt(props.selectedCamera)
      const fileCamera = props.fileCameras[cameraIndex]

      if (fileCamera) {
        // Copy camera properties
        camera.position.copy(fileCamera.position)
        camera.rotation.copy(fileCamera.rotation)

        if (fileCamera instanceof THREE.PerspectiveCamera && camera instanceof THREE.PerspectiveCamera) {
          camera.fov = fileCamera.fov
          camera.updateProjectionMatrix()
        }

        // Update controls target to look at origin (or could be smarter)
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0)
          controlsRef.current.update()
        }

        appliedCameraRef.current = props.selectedCamera
      }
    } else if (props.selectedCamera === 'default') {
      appliedCameraRef.current = null
    }
  }, [props.selectedCamera, props.fileCameras, camera])

  useImperativeHandle(ref, () => ({
    getCameraState: () => {
      if (!controlsRef.current) return null
      const pos = camera.position.toArray() as [number, number, number]
      const target = controlsRef.current.target.toArray() as [number, number, number]
      return { position: pos, target }
    },
    setCameraState: (state) => {
      if (!controlsRef.current) return
      camera.position.set(...state.position)
      controlsRef.current.target.set(...state.target)
      controlsRef.current.update()
    },
    captureScreenshot: () => {
      try {
        return gl.domElement.toDataURL('image/png')
      } catch (e) {
        console.error('Failed to capture screenshot', e)
        return null
      }
    }
  }))

  return (
    <>
      <Model
        url={props.url}
        renderMode={props.renderMode}
        matcapType={props.matcapType}
        onCamerasDetected={props.onCamerasDetected}
        onAnimationsDetected={props.onAnimationsDetected}
        isPlaying={props.isPlaying}
        selectedAnimation={props.selectedAnimation}
      />

      {props.envPreset === 'city' ? (
        <Environment files="/assets/env/potsdamer_platz_1k.hdr" />
      ) : (
        <Environment preset={props.envPreset as any} />
      )}
      <ambientLight intensity={props.envIntensity * 0.6} />
      <directionalLight position={[5, 5, 5]} intensity={props.lightIntensity} castShadow />
      <OrbitControls
        ref={controlsRef}
        autoRotate={props.autoRotate}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        makeDefault
        mouseButtons={{
          LEFT: props.interactionMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: props.interactionMode === 'pan' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN
        }}
        touches={{
          ONE: props.interactionMode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
      />

      {/* EffectComposer always renders; Bloom uses intensity=0 when disabled */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.9}
          luminanceSmoothing={0.025}
          mipmapBlur
          intensity={props.enableBloom ? props.bloomIntensity : 0}
          radius={0.85}
        />
        <ColorAdjustment
          exposure={props.exposure}
          gamma={props.gamma}
        />
      </EffectComposer>
    </>
  )
})
SceneContent.displayName = 'SceneContent'

export const GLBViewer = forwardRef<GLBViewerRef, GLBViewerProps>(({
  url,
  autoRotate: initialAutoRotate = false,
  className,
  initialCameraState,
  showMobileToolbar = false,
  isAdmin = false,
  initialRenderSettings,
  onSaveSettings
}, ref) => {
  // Initialize state with defaults or provided settings
  const [gamma, setGamma] = useState(initialRenderSettings?.gamma ?? 1)
  const [autoRotate, setAutoRotate] = useState(initialAutoRotate)
  const [renderMode, setRenderMode] = useState<RenderMode>('standard')
  const [matcapType, setMatcapType] = useState<MatcapType>('clay')
  const [bgMode, setBgMode] = useState<'transparent' | 'dark' | 'light'>('transparent')
  const [resetTrigger, setResetTrigger] = useState(0)

  // Lighting & Color State (initialized from props)
  const [envPreset, setEnvPreset] = useState(initialRenderSettings?.envPreset || 'city')
  const [envIntensity, setEnvIntensity] = useState(initialRenderSettings?.envIntensity ?? 1)
  const [lightIntensity, setLightIntensity] = useState(initialRenderSettings?.lightIntensity ?? 1.2)
  const [enableBloom, setEnableBloom] = useState(initialRenderSettings?.enablePostProcessing ?? false)
  const [bloomIntensity, setBloomIntensity] = useState(initialRenderSettings?.bloomIntensity ?? 1.5)

  // New Color Management State
  const [exposure, setExposure] = useState<number>(initialRenderSettings?.exposure ?? 1.0)

  const [showLightingPanel, setShowLightingPanel] = useState(false)
  const [showMobileLightingPanel, setShowMobileLightingPanel] = useState(false)
  const [fileCameras, setFileCameras] = useState<THREE.Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>('default')

  // Animation State
  const [animations, setAnimations] = useState<string[]>([])
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)

  // Interaction State
  const [interactionMode, setInteractionMode] = useState<'rotate' | 'pan'>('rotate')

  // Close dropdowns on window resize for better responsive behavior
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        // Close all dropdowns on resize to prevent positioning issues
        setShowLightingPanel(false)
        setShowMobileLightingPanel(false)
      }, 150)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const internalRef = useRef<GLBViewerRef>(null)


  useImperativeHandle(ref, () => ({
    getCameraState: () => internalRef.current?.getCameraState() ?? null,
    setCameraState: (state) => internalRef.current?.setCameraState(state),
    captureScreenshot: () => internalRef.current?.captureScreenshot() ?? null
  }))

  const handleCamerasDetected = (cameras: THREE.Camera[]) => {
    if (cameras.length > 0 && fileCameras.length === 0) {
      setFileCameras(cameras)
    }
  }

  const handleAnimationsDetected = (clips: string[]) => {
    if (clips.length > 0 && animations.length === 0) {
      setAnimations(clips)
      // Auto-play the first animation if available
      if (!selectedAnimation) {
        setSelectedAnimation(clips[0])
      }
    }
  }

  const handleReset = () => {
    setResetTrigger(prev => prev + 1)
    setSelectedCamera('default')
    setInteractionMode('rotate')
    // Reset animation but keep the list
    if (animations.length > 0) setSelectedAnimation(animations[0])
  }

  const handleScreenshot = () => {
    const dataUrl = internalRef.current?.captureScreenshot()
    if (dataUrl) {
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      link.download = `3d-view-${timestamp}.png`
      link.href = dataUrl
      link.click()
    }
  }

  const getBgClass = () => {
    switch (bgMode) {
      case 'dark': return 'bg-neutral-950'
      case 'light': return 'bg-neutral-100'
      default: return 'bg-transparent'
    }
  }

  const envPresets = ['city', 'sunset', 'dawn', 'night', 'warehouse', 'forest', 'apartment', 'studio', 'park', 'lobby']

  // Detect mobile/high-performance constraint devices
  const isMobile = typeof window !== 'undefined' && (window.devicePixelRatio > 1 || window.innerWidth < 768)

  return (
    <div className={cn("relative group", className ?? 'h-[400px]')}>
      <div className={cn("absolute inset-0 transition-colors duration-300", getBgClass())} />

      <Canvas
        key={`${resetTrigger}-${enableBloom}`} // Force re-mount when Bloom changes to fix glitch
        shadows={!isMobile} // Disable shadows on mobile to save VRAM
        camera={{ position: [2, 1.2, 2], fov: 45 }}
        dpr={isMobile ? 1 : [1, 2]} // Strict DPR cap 1.0 on mobile for stability
        className="relative z-0"
        gl={{
          preserveDrawingBuffer: true,
          alpha: true,
          // Disable antialias on high-DPR (mobile) screens
          antialias: !isMobile,
          toneMapping: THREE.NoToneMapping,
        }}
        // Enable transparent rendering
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={<Loader />}>
          <SceneContent
            ref={internalRef}
            url={url}
            autoRotate={autoRotate}
            renderMode={renderMode}
            matcapType={matcapType}
            envPreset={envPreset}
            envIntensity={envIntensity}
            lightIntensity={lightIntensity}
            selectedCamera={selectedCamera}
            fileCameras={fileCameras}
            onCamerasDetected={handleCamerasDetected}
            initialCameraState={initialCameraState}
            enableBloom={isMobile ? false : enableBloom} // Force disable Bloom on mobile
            bloomIntensity={bloomIntensity}
            onAnimationsDetected={handleAnimationsDetected}
            isPlaying={isPlaying}
            selectedAnimation={selectedAnimation}
            interactionMode={interactionMode}
            exposure={exposure}
            gamma={gamma}
          />

        </Suspense>
      </Canvas >




      {/* NEW UI: Left Vertical Toolbar (View Interactions) */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 hidden sm:flex">
        <div className="flex flex-col items-center gap-1 p-1.5 rounded-full bg-background/90 backdrop-blur border shadow-lg">
          {/* Interaction Mode Toggle */}
          <Button
            id="model-interaction-mode"
            variant={interactionMode === 'pan' ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setInteractionMode(prev => prev === 'rotate' ? 'pan' : 'rotate')}
            title={interactionMode === 'rotate' ? 'Chế độ Xoay (Rotate)' : 'Chế độ Di chuyển (Pan)'}
          >
            {interactionMode === 'rotate' ? <Move className="h-4 w-4" /> : <Hand className="h-4 w-4" />}
          </Button>

          <Button
            id="model-reset-view"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
            onClick={handleReset}
            title="Đặt lại góc nhìn"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>

          <Button
            id="model-screenshot"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleScreenshot}
            title="Chụp ảnh"
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Desktop Bottom Toolbar (Model Properties) */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex-col sm:flex-row items-center gap-2 sm:gap-1 ${showMobileToolbar ? 'hidden sm:flex' : 'flex'}`}>
        <div className="glb-toolbar flex items-center gap-1 p-1.5 rounded-full bg-background/90 backdrop-blur border shadow-lg transition-opacity opacity-0 group-hover:opacity-100">


          <Button
            id="model-auto-rotate"
            variant={autoRotate ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setAutoRotate(!autoRotate)}
            title="Tự động xoay"
          >
            <Rotate3d className="h-4 w-4" />
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Render Mode Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                id="model-render-mode"
                variant={renderMode !== 'standard' ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-full"
                title="Chế độ hiển thị"
              >
                {renderMode === 'matcap' ? <Circle className="h-4 w-4" /> : <Box className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={() => setRenderMode('standard')}>
                <span className={renderMode === 'standard' ? 'font-semibold' : ''}>Standard</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenderMode('wireframe')}>
                <span className={renderMode === 'wireframe' ? 'font-semibold' : ''}>Wireframe</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Matcap</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { setRenderMode('matcap'); setMatcapType('clay') }}>
                <span className={renderMode === 'matcap' && matcapType === 'clay' ? 'font-semibold' : ''}>Clay</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRenderMode('matcap'); setMatcapType('metal') }}>
                <span className={renderMode === 'matcap' && matcapType === 'metal' ? 'font-semibold' : ''}>Metal</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRenderMode('matcap'); setMatcapType('ceramic') }}>
                <span className={renderMode === 'matcap' && matcapType === 'ceramic' ? 'font-semibold' : ''}>Ceramic</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRenderMode('matcap'); setMatcapType('plastic') }}>
                <span className={renderMode === 'matcap' && matcapType === 'plastic' ? 'font-semibold' : ''}>Plastic</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Animation Controls */}
          {animations.length > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="model-animation"
                    variant={isPlaying ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    title="Animation"
                  >
                    <Film className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56 p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <span className="text-xs font-medium flex-1 text-center">
                      {isPlaying ? 'Playing' : 'Paused'}
                    </span>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="max-h-48 overflow-y-auto">
                    {animations.map((clip) => (
                      <DropdownMenuItem
                        key={clip}
                        onClick={() => setSelectedAnimation(clip)}
                        className="cursor-pointer"
                      >
                        <span className={selectedAnimation === clip ? 'font-bold text-primary' : ''}>
                          {clip}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="w-px h-4 bg-border mx-1" />
            </>
          )}

          {/* Lighting & Advanced Settings */}
          <DropdownMenu open={showLightingPanel} onOpenChange={setShowLightingPanel}>
            <DropdownMenuTrigger asChild>
              <Button
                id="model-lighting"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                title="Cấu hình hiển thị"
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-72 p-3">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Cài đặt ánh sáng</h4>
                  {isAdmin && onSaveSettings && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-6 text-xs gap-1"
                      onClick={() => onSaveSettings({
                        exposure,
                        enablePostProcessing: enableBloom,
                        bloomIntensity,
                        envPreset,
                        envIntensity,
                        lightIntensity,
                        gamma
                      })}
                    >
                      <Save className="h-3 w-3" /> Lưu
                    </Button>
                  )}
                </div>

                <DropdownMenuSeparator />

                {/* Environment Settings */}
                <div>
                  <label className="text-xs font-medium mb-1 block">Môi trường (HDR)</label>
                  <select
                    className="w-full text-sm border border-border rounded px-2 py-1 bg-background"
                    value={envPreset}
                    onChange={(e) => setEnvPreset(e.target.value)}
                  >
                    {envPresets.map(preset => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Độ sáng MT</label>
                    <Slider
                      value={[envIntensity]}
                      onValueChange={([v]) => setEnvIntensity(v)}
                      min={0}
                      max={3}
                      step={0.1}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Độ sáng đèn</label>
                    <Slider
                      value={[lightIntensity]}
                      onValueChange={([v]) => setLightIntensity(v)}
                      min={0}
                      max={3}
                      step={0.1}
                    />
                  </div>
                </div>

                {/* Admin-only Advanced Render Settings */}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <h4 className="font-medium text-sm text-primary">Advanced (Admin)</h4>

                    <div className="mt-3">
                      <div className="flex justify-between mb-1">
                        <label className="text-xs font-medium">Exposure</label>
                        <span className="text-xs text-muted-foreground">{exposure.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[exposure]}
                        onValueChange={([v]) => setExposure(v)}
                        min={0.1}
                        max={4}
                        step={0.1}
                      />
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between mb-1">
                        <label className="text-xs font-medium">Gamma</label>
                        <span className="text-xs text-muted-foreground">{gamma.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[gamma]}
                        onValueChange={([v]) => setGamma(v)}
                        min={0.2}
                        max={2.5}
                        step={0.1}
                      />
                    </div>



                    <div className="flex items-center justify-between pt-1">
                      <label htmlFor="hq-mode-toggle" className="text-xs font-medium">Bật Bloom Effect</label>
                      <input
                        type="checkbox"
                        id="hq-mode-toggle"
                        checked={enableBloom}
                        onChange={(e) => setEnableBloom(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary"
                      />
                    </div>

                    {enableBloom && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Bloom Intensity</label>
                        <Slider
                          value={[bloomIntensity]}
                          onValueChange={([v]) => setBloomIntensity(v)}
                          min={0}
                          max={5}
                          step={0.1}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Background Toggle */}
          <Button
            variant={bgMode === 'light' ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setBgMode(prev => prev === 'light' ? 'transparent' : 'light')}
            title="Nền sáng"
          >
            <Sun className="h-4 w-4" />
          </Button>

          <Button
            variant={bgMode === 'dark' ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setBgMode(prev => prev === 'dark' ? 'transparent' : 'dark')}
            title="Nền tối"
          >
            <Moon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Toolbar - Inside viewport at bottom center */}
      {
        showMobileToolbar && (
          <div id="mobile-3d-toolbar" className="sm:hidden absolute bottom-2 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-1 p-1.5 bg-background/95 backdrop-blur border rounded-full shadow-lg">
              <Button
                id="mobile-model-auto-rotate"
                variant={autoRotate ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => setAutoRotate(!autoRotate)}
                title="Tự động xoay"
              >
                <Rotate3d className="h-4 w-4" />
              </Button>



              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="mobile-model-render-mode"
                    variant={renderMode !== 'standard' ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full"
                    title="Chế độ hiển thị"
                  >
                    {renderMode === 'matcap' ? <Circle className="h-4 w-4" /> : <Box className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top">
                  <DropdownMenuItem onClick={() => setRenderMode('standard')}>
                    <span className={renderMode === 'standard' ? 'font-semibold' : ''}>Standard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRenderMode('wireframe')}>
                    <span className={renderMode === 'wireframe' ? 'font-semibold' : ''}>Wireframe</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Matcap</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => { setRenderMode('matcap'); setMatcapType('clay') }}>
                    <span className={renderMode === 'matcap' && matcapType === 'clay' ? 'font-semibold' : ''}>Clay</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setRenderMode('matcap'); setMatcapType('metal') }}>
                    <span className={renderMode === 'matcap' && matcapType === 'metal' ? 'font-semibold' : ''}>Metal</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setRenderMode('matcap'); setMatcapType('ceramic') }}>
                    <span className={renderMode === 'matcap' && matcapType === 'ceramic' ? 'font-semibold' : ''}>Ceramic</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setRenderMode('matcap'); setMatcapType('plastic') }}>
                    <span className={renderMode === 'matcap' && matcapType === 'plastic' ? 'font-semibold' : ''}>Plastic</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {fileCameras.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={selectedCamera !== 'default' ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-full"
                      title="Chọn camera"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top">
                    <DropdownMenuItem onClick={() => setSelectedCamera('default')}>
                      <span className={selectedCamera === 'default' ? 'font-semibold' : ''}>Default View</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {fileCameras.map((cam, idx) => (
                      <DropdownMenuItem key={idx} onClick={() => setSelectedCamera(idx.toString())}>
                        <span className={selectedCamera === idx.toString() ? 'font-semibold' : ''}>
                          {cam.name || `Camera ${idx + 1}`}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu open={showMobileLightingPanel} onOpenChange={setShowMobileLightingPanel}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full"
                    title="Ánh sáng"
                  >
                    <Lightbulb className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-64 p-3">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium mb-2 block">Environment</label>
                      <select
                        aria-label="Environment preset"
                        className="w-full text-sm border border-border rounded px-2 py-1 bg-background text-foreground"
                        value={envPreset}
                        onChange={(e) => setEnvPreset(e.target.value)}
                      >
                        {envPresets.map(preset => (
                          <option key={preset} value={preset}>{preset}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-2 block">Env Intensity: {envIntensity.toFixed(1)}</label>
                      <Slider
                        value={[envIntensity]}
                        onValueChange={([v]) => setEnvIntensity(v)}
                        min={0}
                        max={2}
                        step={0.1}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-2 block">Light Intensity: {lightIntensity.toFixed(1)}</label>
                      <Slider
                        value={[lightIntensity]}
                        onValueChange={([v]) => setLightIntensity(v)}
                        min={0}
                        max={3}
                        step={0.1}
                      />
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant={bgMode === 'light' ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => setBgMode(prev => prev === 'light' ? 'transparent' : 'light')}
                title="Nền sáng"
              >
                <Sun className="h-4 w-4" />
              </Button>

              <Button
                variant={bgMode === 'dark' ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => setBgMode(prev => prev === 'dark' ? 'transparent' : 'dark')}
                title="Nền tối"
              >
                <Moon className="h-4 w-4" />
              </Button>

              <Button
                id="mobile-model-screenshot"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={handleScreenshot}
                title="Chụp ảnh"
              >
                <Camera className="h-4 w-4" />
              </Button>

              <Button
                id="mobile-model-reset"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
                onClick={handleReset}
                title="Đặt lại"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      }
    </div >
  )
})
GLBViewer.displayName = 'GLBViewer'
