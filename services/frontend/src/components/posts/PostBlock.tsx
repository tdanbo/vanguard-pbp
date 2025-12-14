import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GripVertical, Trash2, MessageSquare, Swords } from 'lucide-react'
import type { PostBlock as PostBlockType } from '@/types'

interface PostBlockEditorProps {
  block: PostBlockType
  index: number
  onChange: (block: PostBlockType) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}

export function PostBlockEditor({
  block,
  onChange,
  onRemove,
}: PostBlockEditorProps) {
  const [isFocused, setIsFocused] = useState(false)

  const handleTypeChange = (type: 'action' | 'dialog') => {
    onChange({ ...block, type })
  }

  const handleContentChange = (content: string) => {
    onChange({ ...block, content })
  }

  return (
    <div
      className={`group relative rounded-lg border p-3 transition-colors ${
        isFocused ? 'border-primary' : 'border-border'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="cursor-move text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <Select value={block.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="action">
              <div className="flex items-center gap-2">
                <Swords className="h-3 w-3" />
                Action
              </div>
            </SelectItem>
            <SelectItem value="dialog">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3" />
                Dialog
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <Textarea
        value={block.content}
        onChange={(e) => handleContentChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={block.type === 'action' ? 'Describe the action...' : 'Write dialogue...'}
        className={`min-h-[80px] resize-none ${
          block.type === 'dialog' ? 'italic' : ''
        }`}
      />
    </div>
  )
}

interface PostBlockDisplayProps {
  block: PostBlockType
}

export function PostBlockDisplay({ block }: PostBlockDisplayProps) {
  if (block.type === 'dialog') {
    return (
      <p className="text-foreground italic pl-4 border-l-2 border-primary/30">
        "{block.content}"
      </p>
    )
  }

  return <p className="text-foreground">{block.content}</p>
}
