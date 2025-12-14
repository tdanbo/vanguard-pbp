import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface IntentionSelectorProps {
  intentions: string[]
  value: string | null
  onChange: (intention: string | null) => void
  disabled?: boolean
  label?: string
  showNoRoll?: boolean
}

export function IntentionSelector({
  intentions,
  value,
  onChange,
  disabled = false,
  label = 'Intention',
  showNoRoll = true,
}: IntentionSelectorProps) {
  if (!intentions || intentions.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Select
        value={value || 'none'}
        onValueChange={(v) => onChange(v === 'none' ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select intention" />
        </SelectTrigger>
        <SelectContent>
          {showNoRoll && <SelectItem value="none">No roll</SelectItem>}
          {intentions.map((intention) => (
            <SelectItem key={intention} value={intention}>
              {intention}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
