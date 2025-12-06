import { useState, useRef, Suspense, forwardRef, useImperativeHandle, useLayoutEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Html, useGLTF, Center, useMatcapTexture } from '@react-three/drei'
import { Button } from '@/components/ui/button'
import { Rotate3d, Box, Sun, Moon, RefreshCcw, Lightbulb, Camera, Circle } from 'lucide-react'
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
}

type RenderMode = 'standard' | 'wireframe' | 'matcap'
type MatcapType = 'clay' | 'metal' | 'ceramic' | 'plastic'

const MATCAP_TEXTURES: Record<MatcapType, string> = {
  clay: 'C1AA92_AD6E29_737889_CED1D7',      // Standard clay (brownish-grey)
  metal: '3B3C3F_DAD9D5_929290_ABACA8',    // Gray metal - verified working
  ceramic: 'E6E6E6_AAAAAA_C4C4C4_CCCCCC',  // White ceramic
  plastic: '36C8FA_176ACB_24A7EF_1D93EC'   // Blue plastic
}

function Model({
  url,
  renderMode,
  matcapType,
  onCamerasDetected
}: {
  url: string
  renderMode: RenderMode
  matcapType: MatcapType
  onCamerasDetected?: (cameras: THREE.Camera[]) => void
}) {
  const gltf = useGLTF(url)
  const [matcapTexture] = useMatcapTexture(MATCAP_TEXTURES[matcapType], 256)

  const clonedScene = useMemo(() => {
    const cloned = gltf.scene.clone(true)

    // Detect cameras from the GLTF file
    if (onCamerasDetected && gltf.cameras && gltf.cameras.length > 0) {
      onCamerasDetected(gltf.cameras)
    }

    return cloned
  }, [gltf.scene, gltf.cameras, onCamerasDetected])

  useLayoutEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        // Store original material
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material.clone()
        }

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
          // Restore original material
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial
          }
        }
      }
    })
  }, [clonedScene, renderMode, matcapTexture])

  return (
    <Center>
      <primitive object={clonedScene} />
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
}>((props, ref) => {
  const { camera, gl } = useThree()
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
      />

      <Environment preset={props.envPreset as any} />
      <ambientLight intensity={props.envIntensity * 0.6} />
      <directionalLight position={[5, 5, 5]} intensity={props.lightIntensity} castShadow />
      <OrbitControls ref={controlsRef} autoRotate={props.autoRotate} enablePan enableZoom enableRotate makeDefault />
    </>
  )
})
SceneContent.displayName = 'SceneContent'

export const GLBViewer = forwardRef<GLBViewerRef, GLBViewerProps>(({ url, autoRotate: initialAutoRotate = false, className, initialCameraState }, ref) => {
  const [autoRotate, setAutoRotate] = useState(initialAutoRotate)
  const [renderMode, setRenderMode] = useState<RenderMode>('standard')
  const [matcapType, setMatcapType] = useState<MatcapType>('clay')
  const [bgMode, setBgMode] = useState<'transparent' | 'dark' | 'light'>('transparent')
  const [resetTrigger, setResetTrigger] = useState(0)
  const [envPreset, setEnvPreset] = useState('city')
  const [envIntensity, setEnvIntensity] = useState(1)
  const [lightIntensity, setLightIntensity] = useState(1.2)
  const [showLightingPanel, setShowLightingPanel] = useState(false)
  const [fileCameras, setFileCameras] = useState<THREE.Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>('default')

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

  const handleReset = () => {
    setResetTrigger(prev => prev + 1)
    setSelectedCamera('default')
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

  return (
    <div className={cn("relative group", className ?? 'h-[400px]')}>
      <div className={cn("absolute inset-0 transition-colors duration-300", getBgClass())} />

      <Canvas
        key={resetTrigger}
        shadows
        camera={{ position: [2, 1.2, 2], fov: 45 }}
        dpr={[1, 2]}
        className="relative z-0"
        gl={{ preserveDrawingBuffer: true }}
      >
        <Suspense
          fallback={
            <Html center>
              <div className="flex flex-col items-center gap-2 text-muted-foreground bg-background/80 px-4 py-3 rounded-lg border backdrop-blur-sm">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
                <div className="text-sm font-medium">Đang tải mô hình 3D...</div>
              </div>
            </Html>
          }
        >
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
          />
        </Suspense>
      </Canvas>

      {/* Floating Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col sm:flex-row items-center gap-2 sm:gap-1">
        {/* Main Toolbar */}
        <div className="glb-toolbar flex items-center gap-1 p-1.5 rounded-full bg-background/90 backdrop-blur border shadow-lg transition-opacity opacity-0 group-hover:opacity-100">
          <Button
            variant={autoRotate ? "secondary" : "ghost"}
            id="model-auto-rotate"
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

          {/* Camera Selector */}
          {fileCameras.length > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="model-camera-selector"
                    variant={selectedCamera !== 'default' ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    title="Chọn camera"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
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
              <div className="w-px h-4 bg-border mx-1" />
            </>
          )}

          {/* Lighting Controls */}
          <DropdownMenu open={showLightingPanel} onOpenChange={setShowLightingPanel}>
            <DropdownMenuTrigger asChild>
              <Button
                id="model-lighting"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                title="Điều khiển ánh sáng"
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64 p-3">
              <div className="space-y-4">
                <div>
                  <label htmlFor="env-preset-select" className="text-xs font-medium mb-2 block">Environment</label>
                  <select
                    id="env-preset-select"
                    aria-label="Environment preset"
                    title="Environment preset"
                    className="w-full text-sm border border-border rounded px-2 py-1 bg-background text-foreground"
                    value={envPreset}
                    onChange={(e) => setEnvPreset(e.target.value)}
                  >
                    {envPresets.map(preset => (
                      <option key={preset} value={preset} className="bg-background text-foreground">{preset}</option>
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

          <div className="w-px h-4 bg-border mx-1" />

          <Button
            id="model-bg-light"
            variant={bgMode === 'light' ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setBgMode(prev => prev === 'light' ? 'transparent' : 'light')}
            title="Nền sáng"
          >
            <Sun className="h-4 w-4" />
          </Button>

          <Button
            id="model-bg-dark"
            variant={bgMode === 'dark' ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setBgMode(prev => prev === 'dark' ? 'transparent' : 'dark')}
            title="Nền tối"
          >
            <Moon className="h-4 w-4" />
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

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

          <Button
            id="model-reset"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
            onClick={handleReset}
            title="Đặt lại góc nhìn"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
})
GLBViewer.displayName = 'GLBViewer'
