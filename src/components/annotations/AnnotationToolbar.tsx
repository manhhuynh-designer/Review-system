import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
    Pencil,
    Square,
    ArrowRight,
    MousePointer,
    Eraser,
    Undo2,
    Redo2,
    Trash2,
    Check,
    GripHorizontal
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface AnnotationToolbarProps {
    tool: 'pen' | 'rect' | 'arrow' | 'select' | 'eraser'
    onToolChange: (tool: 'pen' | 'rect' | 'arrow' | 'select' | 'eraser') => void
    color: string
    onColorChange: (color: string) => void
    strokeWidth: number
    onStrokeWidthChange: (width: number) => void
    onUndo: () => void
    onRedo: () => void
    onClear: () => void
    onDone: () => void
    canUndo: boolean
    canRedo: boolean
}

const COLORS = [
    { name: 'Yellow', value: '#ffff00' },
    { name: 'Red', value: '#ff0000' },
    { name: 'Green', value: '#00ff00' },
    { name: 'Blue', value: '#0099ff' },
    { name: 'White', value: '#ffffff' },
    { name: 'Black', value: '#000000' },
]

export function AnnotationToolbar({
    tool,
    onToolChange,
    color,
    onColorChange,
    strokeWidth,
    onStrokeWidthChange,
    onUndo,
    onRedo,
    onClear,
    onDone,
    canUndo,
    canRedo
}: AnnotationToolbarProps) {
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const isDragging = useRef(false)
    const dragStart = useRef({ x: 0, y: 0 })
    const toolbarRef = useRef<HTMLDivElement>(null)

    const toolButtons = [
        { id: 'pen' as const, icon: Pencil, label: 'Pen' },
        { id: 'rect' as const, icon: Square, label: 'Rectangle' },
        { id: 'arrow' as const, icon: ArrowRight, label: 'Arrow' },
        { id: 'select' as const, icon: MousePointer, label: 'Select' },
        { id: 'eraser' as const, icon: Eraser, label: 'Eraser' },
    ]

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target instanceof Element && e.target.closest('button')) return
        isDragging.current = true
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        }
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return
            setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
            })
        }

        const handleMouseUp = () => {
            isDragging.current = false
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    return (
        <div
            ref={toolbarRef}
            className="absolute bottom-4 left-1/2 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 flex flex-col gap-3 z-10 cursor-move select-none"
            style={{
                transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Drag Handle */}
            <div className="flex justify-center -mt-1 mb-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <GripHorizontal className="w-5 h-5" />
            </div>

            {/* Drawing Tools */}
            <div className="flex items-center gap-1">
                {toolButtons.map(({ id, icon: Icon, label }) => (
                    <Button
                        key={id}
                        variant={tool === id ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onToolChange(id)}
                        className="h-9 w-9 p-0"
                        title={label}
                    >
                        <Icon className="w-4 h-4" />
                    </Button>
                ))}
            </div>

            <Separator />

            {/* Properties */}
            <div className="flex items-center gap-3">
                {/* Stroke Width */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Width:</span>
                    <Slider
                        value={[strokeWidth]}
                        onValueChange={(values) => onStrokeWidthChange(values[0])}
                        min={1}
                        max={10}
                        step={1}
                        className="w-24"
                    />
                    <span className="text-xs text-muted-foreground w-6">{strokeWidth}px</span>
                </div>

                <Separator orientation="vertical" className="h-6" />

                {/* Color Palette */}
                <div className="flex items-center gap-1">
                    {COLORS.map((c) => (
                        <button
                            key={c.value}
                            onClick={() => onColorChange(c.value)}
                            className={`w-7 h-7 rounded-full border-2 transition-all ${color === c.value ? 'border-primary scale-110' : 'border-muted hover:border-muted-foreground'
                                }`}
                            style={{ backgroundColor: c.value }}
                            title={c.name}
                            aria-label={`Color: ${c.name}`}
                        />
                    ))}
                </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="h-8 px-2"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 className="w-4 h-4 mr-1" />
                    Undo
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="h-8 px-2"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 className="w-4 h-4 mr-1" />
                    Redo
                </Button>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    title="Clear all"
                >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                </Button>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <Button
                    variant="default"
                    size="sm"
                    onClick={onDone}
                    className="h-8 px-3"
                >
                    <Check className="w-4 h-4 mr-1" />
                    Done
                </Button>
            </div>
        </div>
    )
}
