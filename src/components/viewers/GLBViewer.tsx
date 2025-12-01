import { Suspense, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'

type GLBViewerProps = {
  url: string
  autoRotate?: boolean
  className?: string
}

export interface GLBViewerRef {
  getCameraState: () => { position: [number, number, number], target: [number, number, number] } | null
  setCameraState: (state: { position: [number, number, number], target: [number, number, number] }) => void
}

function FitAndRender({ url, autoRotate = true }: { url: string; autoRotate?: boolean }) {
  const { scene: gltf } = useGLTF(url, true)
  const group = useRef<THREE.Group>(null)
  const { camera } = useThree()

  // Center and scale model to fit view
  useEffect(() => {
    if (!group.current) return
    const box = new THREE.Box3().setFromObject(group.current)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    // Re-center model at origin
    group.current.position.x -= center.x
    group.current.position.y -= center.y
    group.current.position.z -= center.z

    // Fit camera distance
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const distance = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.6
    camera.position.set(distance, distance * 0.6, distance)
      ; (camera as THREE.PerspectiveCamera).near = distance / 100
      ; (camera as THREE.PerspectiveCamera).far = distance * 100
    camera.updateProjectionMatrix()
  }, [camera])

  useFrame((_, delta) => {
    if (autoRotate && group.current) {
      group.current.rotation.y += delta * 0.3
    }
  })

  return (
    <group ref={group}>
      <primitive object={gltf} />
    </group>
  )
}

const SceneContent = forwardRef<GLBViewerRef, { url: string, autoRotate: boolean }>((props, ref) => {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

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
    }
  }))

  return (
    <>
      <FitAndRender url={props.url} autoRotate={props.autoRotate} />
      <Environment preset="city" />
      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate makeDefault />
    </>
  )
})
SceneContent.displayName = 'SceneContent'

export const GLBViewer = forwardRef<GLBViewerRef, GLBViewerProps>(({ url, autoRotate = true, className }, ref) => {
  return (
    <div className={className ?? 'h-[400px]'}>
      <Canvas shadows camera={{ position: [2, 1.2, 2], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
        <Suspense
          fallback={
            <Html center>
              <div className="text-sm text-muted-foreground bg-background/80 px-3 py-2 rounded-md border">
                Đang tải mô hình 3D...
              </div>
            </Html>
          }
        >
          <SceneContent ref={ref} url={url} autoRotate={autoRotate} />
        </Suspense>
      </Canvas>
    </div>
  )
})
GLBViewer.displayName = 'GLBViewer'

