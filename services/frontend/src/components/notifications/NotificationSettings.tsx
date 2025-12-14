import { useState, useEffect } from 'react'
import { Bell, Moon, Mail, Clock, Globe } from 'lucide-react'
import { useNotificationPreferences, useQuietHours } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import type { EmailFrequency } from '@/types'

interface NotificationSettingsProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function NotificationSettings({
  open,
  onOpenChange,
  trigger,
}: NotificationSettingsProps) {
  const { toast } = useToast()
  const {
    preferences,
    isLoading: loadingPrefs,
    updatePreferences,
  } = useNotificationPreferences()
  const {
    quietHours,
    isLoading: loadingQuiet,
    updateQuietHours,
  } = useQuietHours()

  // Local state for form
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [emailFrequency, setEmailFrequency] = useState<EmailFrequency>('realtime')
  const [inAppEnabled, setInAppEnabled] = useState(true)
  const [quietEnabled, setQuietEnabled] = useState(false)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('08:00')
  const [timezone, setTimezone] = useState('UTC')
  const [urgentBypass, setUrgentBypass] = useState(false)
  const [saving, setSaving] = useState(false)

  // Initialize from preferences
  useEffect(() => {
    if (preferences) {
      setEmailEnabled(preferences.email_enabled)
      setEmailFrequency(preferences.email_frequency)
      setInAppEnabled(preferences.in_app_enabled)
    }
  }, [preferences])

  // Initialize from quiet hours
  useEffect(() => {
    if (quietHours) {
      setQuietEnabled(quietHours.enabled)
      setQuietStart(quietHours.start_time || '22:00')
      setQuietEnd(quietHours.end_time || '08:00')
      setTimezone(quietHours.timezone || 'UTC')
      setUrgentBypass(quietHours.urgent_bypass)
    }
  }, [quietHours])

  // Detect user's timezone
  useEffect(() => {
    if (!quietHours?.timezone) {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(userTimezone)
    }
  }, [quietHours])

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        updatePreferences({
          email_enabled: emailEnabled,
          email_frequency: emailFrequency,
          in_app_enabled: inAppEnabled,
        }),
        updateQuietHours({
          enabled: quietEnabled,
          start_time: quietStart,
          end_time: quietEnd,
          timezone,
          urgent_bypass: urgentBypass,
        }),
      ])
      toast({
        title: 'Settings saved',
        description: 'Your notification preferences have been updated.',
      })
      onOpenChange?.(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save settings',
        description: (error as Error).message,
      })
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <div className="space-y-6">
      {/* In-App Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            In-App Notifications
          </CardTitle>
          <CardDescription>
            Notifications shown within the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="in-app-enabled">Enable in-app notifications</Label>
            <Switch
              id="in-app-enabled"
              checked={inAppEnabled}
              onCheckedChange={setInAppEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications via email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled">Enable email notifications</Label>
            <Switch
              id="email-enabled"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
            />
          </div>
          {emailEnabled && (
            <div className="space-y-2">
              <Label htmlFor="email-frequency">Delivery frequency</Label>
              <Select
                value={emailFrequency}
                onValueChange={(value: EmailFrequency) => setEmailFrequency(value)}
              >
                <SelectTrigger id="email-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time</SelectItem>
                  <SelectItem value="digest_daily">Daily digest</SelectItem>
                  <SelectItem value="digest_weekly">Weekly digest</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {emailFrequency === 'realtime' &&
                  'Receive emails immediately when events occur'}
                {emailFrequency === 'digest_daily' &&
                  'Receive a summary email once per day'}
                {emailFrequency === 'digest_weekly' &&
                  'Receive a summary email once per week'}
                {emailFrequency === 'off' && 'No email notifications'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-4 w-4" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Pause real-time email notifications during specific hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-enabled">Enable quiet hours</Label>
            <Switch
              id="quiet-enabled"
              checked={quietEnabled}
              onCheckedChange={setQuietEnabled}
            />
          </div>
          {quietEnabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quiet-start" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Start time
                  </Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiet-end" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    End time
                  </Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT)</SelectItem>
                    <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                    <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                    <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="urgent-bypass">Allow urgent notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Urgent notifications will still be delivered during quiet hours
                  </p>
                </div>
                <Switch
                  id="urgent-bypass"
                  checked={urgentBypass}
                  onCheckedChange={setUrgentBypass}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange?.(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || loadingPrefs || loadingQuiet}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>
              Configure how and when you receive notifications
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return content
}

// Standalone page version
export function NotificationSettingsPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Notification Settings</h1>
      <NotificationSettings />
    </div>
  )
}
