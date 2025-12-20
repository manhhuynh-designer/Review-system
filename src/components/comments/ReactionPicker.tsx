import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { SmilePlus } from 'lucide-react'

interface ReactionPickerProps {
    onSelect: (reaction: string) => void
    disabled?: boolean
}

export const REACTION_TYPES = {
    like: '👍',
    love: '❤️',
    haha: '😄',
    wow: '😮',
    sad: '😢',
    angry: '😠',
    check: '✅'
}

export function ReactionPicker({ onSelect, disabled }: ReactionPickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                    title="Thả cảm xúc"
                >
                    <SmilePlus className="w-3.5 h-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1" align="start" side="top">
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {Object.entries(REACTION_TYPES).map(([key, emoji]) => (
                        <button
                            key={key}
                            onClick={() => onSelect(key)}
                            className="p-1.5 hover:bg-muted rounded-md text-lg transition-transform hover:scale-125"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}
