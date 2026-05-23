import { Bell, Globe2, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { appSettingsOptions } from '@/lib/profile-data'

const settingIcons = [Bell, Lock, Globe2]

export default function ProfileAppSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>App Settings</CardTitle>
        <p className="text-sm text-gray-600">
          Review the app defaults currently powering your order updates and regional preferences.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {appSettingsOptions.map((option, index) => {
          const Icon = settingIcons[index] || Bell
          return (
            <div key={option.title} className="flex items-start gap-4 rounded-2xl border p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <Icon className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{option.title}</p>
                  <Badge variant="secondary" className="text-xs">
                    Enabled
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-600">{option.description}</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
