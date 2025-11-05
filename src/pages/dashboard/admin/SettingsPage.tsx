import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ProfileSection } from '@/components/dashboard/ProfileSection';
import { Building2, Bell, Shield, Database, Key } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage system settings and configurations</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <div>
                  <CardTitle>School Information</CardTitle>
                  <CardDescription>Basic information about your institution</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">School Name</Label>
                <Input id="school-name" defaultValue="EduPay Connect School" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-address">Address</Label>
                <Input id="school-address" placeholder="Enter school address" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="+234 800 000 0000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="admin@school.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Input id="currency" defaultValue="NGN (₦)" disabled />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Configure user registration and access settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Confirmation Required</Label>
                  <p className="text-sm text-muted-foreground">Require users to verify their email before login</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Self Registration</Label>
                  <p className="text-sm text-muted-foreground">Allow new users to register without admin approval</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input id="session-timeout" type="number" defaultValue="30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-password">Minimum Password Length</Label>
                <Input id="min-password" type="number" defaultValue="8" />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Configuration</CardTitle>
              <CardDescription>Manage payment categories and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="transaction-fee">Transaction Fee (%)</Label>
                <Input id="transaction-fee" type="number" defaultValue="0" step="0.1" />
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min-topup">Minimum Top-up Amount</Label>
                  <Input id="min-topup" type="number" defaultValue="100" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-topup">Maximum Top-up Amount</Label>
                  <Input id="max-topup" type="number" defaultValue="50000" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Low Balance Alerts</Label>
                  <p className="text-sm text-muted-foreground">Notify users when balance is low</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-2">
                <Label htmlFor="low-balance">Low Balance Threshold</Label>
                <Input id="low-balance" type="number" defaultValue="500" />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <div>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Configure notification preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send email for important events</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Transaction Notifications</Label>
                  <p className="text-sm text-muted-foreground">Notify users of all transactions</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Low Balance Warnings</Label>
                  <p className="text-sm text-muted-foreground">Alert when wallet balance is low</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <div>
                  <CardTitle>System Configuration</CardTitle>
                  <CardDescription>Advanced system settings and maintenance</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Database</h4>
                  <div className="flex gap-2">
                    <Button variant="outline">Backup Database</Button>
                    <Button variant="outline">View Activity Logs</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">API Access</h4>
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <code className="text-sm bg-muted px-2 py-1 rounded">api_key_xxxxxxxxxxxx</code>
                    <Button variant="outline" size="sm">Regenerate</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Maintenance Mode</h4>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Enable maintenance mode for system updates</p>
                    <Switch />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Profile */}
        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
