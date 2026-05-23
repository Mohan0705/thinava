'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { adminApi } from '@/features/admin/api'
import { useAdminAuthStore } from '@/features/admin/auth-store'
import { adminPermissions } from '@/features/admin/permissions'
import { PlatformSetting } from '@/features/admin/types'
import { useAdminQuery } from '@/features/admin/use-admin-query'

export default function AdminSettingsPage() {
  const token = useAdminAuthStore((state) => state.token)
  const admin = useAdminAuthStore((state) => state.admin)
  const { data, setData } = useAdminQuery(
    async () => adminApi.getSettings(token || ''),
    [token],
    30000
  )
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const canManageSettings = admin?.permissions.includes('settings:manage') ?? false

  useEffect(() => {
    if (!data?.settings) {
      return
    }
    setDrafts(
      Object.fromEntries(
        data.settings.map((setting) => [setting.setting_key, JSON.stringify(setting.setting_value, null, 2)])
      )
    )
  }, [data])

  const handleSave = async () => {
    try {
      const settings = (data?.settings || []).map((setting: PlatformSetting) => ({
        setting_key: setting.setting_key,
        setting_value: JSON.parse(drafts[setting.setting_key] || 'null'),
        description: setting.description,
        category: setting.category,
      }))

      const refreshed = await adminApi.updateSettings(token || '', settings)
      setData(refreshed)
      toast.success('Platform settings saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save settings')
    }
  }

  return (
    <AdminPageShell
      title="Platform Settings"
      description="Tune delivery radius, taxes, operational windows, maintenance mode, and pricing controls from one governance surface."
      permission={adminPermissions.settings}
      actions={canManageSettings ? <Button onClick={handleSave}>Save Settings</Button> : undefined}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {data?.settings.map((setting) => (
          <Card key={setting.id} className="border border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle className="text-xl">{setting.setting_key}</CardTitle>
              <p className="text-sm text-slate-500">{setting.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={drafts[setting.setting_key] || ''}
                onChange={(event) => setDrafts((current) => ({ ...current, [setting.setting_key]: event.target.value }))}
                className="min-h-[180px] font-mono text-sm"
                disabled={!canManageSettings}
              />
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {setting.category} · updated {new Date(setting.updated_at).toLocaleString('en-IN')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminPageShell>
  )
}
