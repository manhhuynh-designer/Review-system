import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Rect, Arrow, Transformer } from 'react-konva'
import type { AnnotationObject } from '@/types'
import { denormalizePoints, denormalize, normalize } from '@/utils/canvas'

interface Props {
  mode?: 'read' | 'edit'
  data?: AnnotationObject[]
  tool?: 'pen' | 'rect' | 'arrow' | 'select' | 'eraser'
  color?: string
  strokeWidth?: number
  onChange?: (data: AnnotationObject[] | null) => void
  width?: number
  height?: number
  onUndo?: () => void
  onRedo?: () => void
}

export function AnnotationCanvasKonva({
  mode = 'read',
  data = [],
  tool = 'pen',
  color = '#ffff00',
  strokeWidth = 2,
  onChange,
  width: propW,
  height: propH,
  onUndo,
  onRedo
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<any>(null)
  const transformerRef = useRef<any>(null)
  const shapeRefs = useRef<Record<string, any>>({})

  const [shapes, setShapes] = useState<AnnotationObject[]>(data || [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawingId, setDrawingId] = useState<string | null>(null)
  const [stageSize, setStageSize] = useState({ w: propW || 800, h: propH || 400 })

  useEffect(() => setShapes(data || []), [data])

  useEffect(() => {
    const resize = () => {
      if (propW && propH) {
        setStageSize({ w: propW, h: propH })
        return
      }
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setStageSize({ w: Math.max(10, rect.width), h: Math.max(10, rect.height) })
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [propW, propH])

  // Avoid calling onChange on initial mount to prevent update loops
  const _shapesInitialized = useRef(false)
  useEffect(() => {
    if (!_shapesInitialized.current) {
      _shapesInitialized.current = true
      return
    }
    // We don't call onChange here automatically anymore to avoid loops with parent history
    // onChange is called only on user interaction end
  }, [shapes])

  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    if (selectedId && shapeRefs.current[selectedId]) {
      tr.nodes([shapeRefs.current[selectedId]])
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
    }
  }, [selectedId, stageSize])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Undo/Redo shortcuts - delegate to parent
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        onUndo?.()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        onRedo?.()
        return
      }

      // Delete selected shape
      if (!selectedId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const newShapes = shapes.filter(s => s.id !== selectedId)
        setShapes(newShapes)
        onChange?.(newShapes)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, shapes, onUndo, onRedo, onChange])

  const getRelativePointer = () => {
    const stage = stageRef.current
    if (!stage) return null
    const pos = stage.getPointerPosition()
    if (!pos) return null
    return { x: pos.x, y: pos.y }
  }

  const startDrawing = (absX: number, absY: number) => {
    const id = `a_${Date.now()}`
    const nx = normalize(absX, stageSize.w)
    const ny = normalize(absY, stageSize.h)
    if (tool === 'pen') {
      const shape: AnnotationObject = { id, type: 'pen', color, strokeWidth, points: [nx, ny] }
      setShapes(prev => [...prev.filter(s => s.id !== id), shape])
      setDrawingId(id)
    } else if (tool === 'rect') {
      const shape: AnnotationObject = { id, type: 'rect', color, strokeWidth, x: nx, y: ny, w: 0, h: 0 }
      setShapes(prev => [...prev.filter(s => s.id !== id), shape])
      setDrawingId(id)
    } else if (tool === 'arrow') {
      const shape: AnnotationObject = { id, type: 'arrow', color, strokeWidth, startPoint: { x: nx, y: ny }, endPoint: { x: nx, y: ny } }
      setShapes(prev => [...prev.filter(s => s.id !== id), shape])
      setDrawingId(id)
    }
  }

  const handleMouseDown = (e: any) => {
    if (mode !== 'edit') return
    const pos = getRelativePointer()
    if (!pos) return
    const clickedOnEmpty = e.target === e.target.getStage()
    if (tool === 'select') {
      if (clickedOnEmpty) setSelectedId(null)
      return
    }
    startDrawing(pos.x, pos.y)
  }

  const handleMouseMove = () => {
    if (mode !== 'edit' || !drawingId) return
    const pos = getRelativePointer()
    if (!pos) return
    setShapes(prev => prev.map(s => {
      if (s.id !== drawingId) return s
      if (s.type === 'pen') {
        const pts = s.points || []
        const nx = normalize(pos.x, stageSize.w)
        const ny = normalize(pos.y, stageSize.h)
        return { ...s, points: [...pts, nx, ny] }
      } else if (s.type === 'rect') {
        const startX = s.x || 0
        const startY = s.y || 0
        const curX = normalize(pos.x, stageSize.w)
        const curY = normalize(pos.y, stageSize.h)
        return { ...s, w: curX - startX, h: curY - startY }
      } else if (s.type === 'arrow') {
        const curX = normalize(pos.x, stageSize.w)
        const curY = normalize(pos.y, stageSize.h)
        return { ...s, endPoint: { x: curX, y: curY } }
      }
      return s
    }))
  }

  const finishDrawing = () => {
    if (!drawingId) return
    const updatedShapes = shapes.map(s => {
      if (s.id !== drawingId) return s
      if (s.type === 'rect') {
        if (s.w && s.w < 0) {
          s.x = (s.x || 0) + s.w
          s.w = Math.abs(s.w)
        }
        if (s.h && s.h < 0) {
          s.y = (s.y || 0) + s.h
          s.h = Math.abs(s.h)
        }
      }
      return s
    })
    setShapes(updatedShapes)
    onChange?.(updatedShapes)
    setDrawingId(null)
  }

  const handleStageClick = (e: any) => {
    if (tool === 'select') return
    const clickedOnEmpty = e.target === e.target.getStage()
    if (clickedOnEmpty) setSelectedId(null)
  }

  const handleShapeClick = (id: string, e?: any) => {
    if (tool === 'select') {
      setSelectedId(id)
    } else if (tool === 'eraser') {
      const shape = shapes.find(s => s.id === id)
      if (!shape) return

      // For pen strokes, implement partial deletion
      if (shape.type === 'pen' && e) {
        const stage = stageRef.current
        if (!stage) return

        const pos = stage.getPointerPosition()
        if (!pos) return

        const points = shape.points || []
        if (points.length < 4) {
          // Too few points, delete entire stroke
          const newShapes = shapes.filter(s => s.id !== id)
          setShapes(newShapes)
          onChange?.(newShapes)
          return
        }

        // Find the closest point on the stroke
        let minDist = Infinity

        for (let i = 0; i < points.length; i += 2) {
          const px = denormalize(points[i], stageSize.w)
          const py = denormalize(points[i + 1], stageSize.h)
          const dist = Math.sqrt((px - pos.x) ** 2 + (py - pos.y) ** 2)
          if (dist < minDist) {
            minDist = dist
          }
        }

        // Define eraser radius (in pixels)
        const eraserRadius = 20

        if (minDist > eraserRadius) {
          // Click was too far from stroke, don't delete anything
          return
        }

        // Remove points within eraser radius
        const newPoints: number[] = []

        for (let i = 0; i < points.length; i += 2) {
          const px = denormalize(points[i], stageSize.w)
          const py = denormalize(points[i + 1], stageSize.h)
          const dist = Math.sqrt((px - pos.x) ** 2 + (py - pos.y) ** 2)

          if (dist > eraserRadius) {
            newPoints.push(points[i], points[i + 1])
          }
        }

        if (newPoints.length < 4) {
          // After erasing, too few points remain, delete entire stroke
          const newShapes = shapes.filter(s => s.id !== id)
          setShapes(newShapes)
          onChange?.(newShapes)
        } else {
          // Update the stroke with remaining points
          const newShapes = shapes.map(s =>
            s.id === id ? { ...s, points: newPoints } : s
          )
          setShapes(newShapes)
          onChange?.(newShapes)
        }
      } else {
        // For other shapes (rect, arrow, text), delete the entire shape
        const newShapes = shapes.filter(s => s.id !== id)
        setShapes(newShapes)
        onChange?.(newShapes)
      }
    }
  }

  const onTransformEnd = (id: string) => {
    const node = shapeRefs.current[id]
    if (!node) return
    const attrs = node.getAttrs ? node.getAttrs() : node.attrs
    const newShapes = shapes.map(s => {
      if (s.id !== id) return s
      if (s.type === 'rect') {
        const x = normalize(attrs.x || 0, stageSize.w)
        const y = normalize(attrs.y || 0, stageSize.h)
        const w = (attrs.width || 0) * (attrs.scaleX || 1) / stageSize.w
        const h = (attrs.height || 0) * (attrs.scaleY || 1) / stageSize.h
        return { ...s, x, y, w, h, rotation: attrs.rotation || 0, scaleX: attrs.scaleX || 1, scaleY: attrs.scaleY || 1 }
      }
      if (s.type === 'arrow') {
        const pts: number[] = node.points ? node.points() : attrs.points || []
        if (pts.length >= 4) {
          const sx = normalize(pts[0], stageSize.w)
          const sy = normalize(pts[1], stageSize.h)
          const ex = normalize(pts[2], stageSize.w)
          const ey = normalize(pts[3], stageSize.h)
          return { ...s, startPoint: { x: sx, y: sy }, endPoint: { x: ex, y: ey }, rotation: attrs.rotation || 0 }
        }
      }
      return s
    })
    setShapes(newShapes)
    onChange?.(newShapes)
  }

  const onDragEnd = (id: string) => {
    const node = shapeRefs.current[id]
    if (!node) return
    const attrs = node.getAttrs ? node.getAttrs() : node.attrs
    const newShapes = shapes.map(s => {
      if (s.id !== id) return s
      if (s.type === 'rect') {
        const x = normalize(attrs.x || 0, stageSize.w)
        const y = normalize(attrs.y || 0, stageSize.h)
        return { ...s, x, y }
      }
      if (s.type === 'arrow') {
        const pts: number[] = node.points ? node.points() : attrs.points || []
        if (pts.length >= 4) {
          const sx = normalize(pts[0] + (attrs.x || 0), stageSize.w)
          const sy = normalize(pts[1] + (attrs.y || 0), stageSize.h)
          const ex = normalize(pts[2] + (attrs.x || 0), stageSize.w)
          const ey = normalize(pts[3] + (attrs.y || 0), stageSize.h)
          // Reset position to 0,0 after incorporating into points
          node.position({ x: 0, y: 0 })
          return { ...s, startPoint: { x: sx, y: sy }, endPoint: { x: ex, y: ey } }
        }
      }
      return s
    })
    setShapes(newShapes)
    onChange?.(newShapes)
  }

  const cursorClass = mode === 'read' ? 'cursor-default' : (tool === 'select' ? 'cursor-default' : (tool === 'pen' || tool === 'rect' || tool === 'arrow') ? 'cursor-crosshair' : (tool === 'eraser' ? 'cursor-pointer' : 'cursor-default'))

  return (
    <div ref={containerRef} className={`absolute inset-0 w-full h-full ${mode === 'read' ? 'pointer-events-none' : ''}`}>
      <Stage
        width={stageSize.w}
        height={stageSize.h}
        ref={stageRef}
        onMouseDown={(e) => { handleMouseDown(e); handleStageClick(e) }}
        onTouchStart={(e) => { handleMouseDown(e); handleStageClick(e) }}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseUp={finishDrawing}
        onTouchEnd={finishDrawing}
        className={cursorClass}
      >
        <Layer>
          {shapes.map(s => {
            if (s.type === 'pen') {
              const pts = denormalizePoints(s.points || [], stageSize.w, stageSize.h)
              return (
                <Line
                  key={s.id}
                  points={pts}
                  stroke={s.color || color}
                  strokeWidth={s.strokeWidth || strokeWidth}
                  tension={0.2}
                  lineCap="round"
                  lineJoin="round"
                  listening={true}
                  hitStrokeWidth={10}
                  onClick={(e) => handleShapeClick(s.id, e)}
                  ref={(node) => { shapeRefs.current[s.id] = node }}
                />
              )
            }
            if (s.type === 'rect') {
              const x = denormalize(s.x || 0, stageSize.w)
              const y = denormalize(s.y || 0, stageSize.h)
              const w = denormalize(s.w || 0, stageSize.w)
              const h = denormalize(s.h || 0, stageSize.h)
              return (
                <Rect
                  key={s.id}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  stroke={s.color || color}
                  strokeWidth={s.strokeWidth || strokeWidth}
                  rotation={s.rotation || 0}
                  scaleX={s.scaleX || 1}
                  scaleY={s.scaleY || 1}
                  onClick={() => handleShapeClick(s.id)}
                  onTransformEnd={() => onTransformEnd(s.id)}
                  onDragEnd={() => onDragEnd(s.id)}
                  ref={(node) => { shapeRefs.current[s.id] = node }}
                  draggable={tool === 'select'}
                />
              )
            }
            if (s.type === 'arrow') {
              const sx = (s.startPoint?.x || 0) * stageSize.w
              const sy = (s.startPoint?.y || 0) * stageSize.h
              const ex = (s.endPoint?.x || 0) * stageSize.w
              const ey = (s.endPoint?.y || 0) * stageSize.h
              return (
                <Arrow
                  key={s.id}
                  points={[sx, sy, ex, ey]}
                  stroke={s.color || color}
                  fill={s.color || color}
                  strokeWidth={s.strokeWidth || strokeWidth}
                  pointerLength={8}
                  pointerWidth={8}
                  onClick={() => handleShapeClick(s.id)}
                  onTransformEnd={() => onTransformEnd(s.id)}
                  onDragEnd={() => onDragEnd(s.id)}
                  ref={(node) => { shapeRefs.current[s.id] = node }}
                  draggable={tool === 'select'}
                />
              )
            }
            return null
          })}
          <Transformer ref={transformerRef} rotateEnabled={true} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']} />
        </Layer>
      </Stage>
    </div>
  )
}
