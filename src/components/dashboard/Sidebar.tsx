import { LayoutDashboard, Wallet, History, User, Settings, LogOut, Menu, Upload, Webhook, GitCompare } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar as SidebarUI,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const studentItems = [
  { title: 'Dashboard', url: '/dashboard/student', icon: LayoutDashboard },
  { title: 'My Wallet', url: '/dashboard/student/wallet', icon: Wallet },
  { title: 'Transactions', url: '/dashboard/student/transactions', icon: History },
  { title: 'Profile', url: '/profile/edit', icon: User },
];

const parentItems = [
  { title: 'Dashboard', url: '/dashboard/parent', icon: LayoutDashboard },
  { title: 'Children', url: '/dashboard/parent/children', icon: User },
  { title: 'Transactions', url: '/dashboard/parent/transactions', icon: History },
  { title: 'Profile', url: '/profile/edit', icon: User },
];

const adminItems = [
  { title: 'Dashboard', url: '/dashboard/admin', icon: LayoutDashboard },
  { title: 'Students', url: '/dashboard/admin/students', icon: User },
  { title: 'Parents', url: '/dashboard/admin/parents', icon: User },
  { title: 'Transactions', url: '/dashboard/admin/transactions', icon: History },
  { title: 'Bulk Import', url: '/dashboard/admin/bulk-import', icon: Upload },
  { title: 'Webhooks', url: '/dashboard/admin/webhooks', icon: Webhook },
  { title: 'Reconciliation', url: '/dashboard/admin/reconciliation', icon: GitCompare },
  { title: 'Settings', url: '/dashboard/admin/settings', icon: Settings },
];

export const Sidebar = () => {
  const { state } = useSidebar();
  const { signOut, user, profile } = useAuth();
  const { data: userRole } = useUserRole();
  const navigate = useNavigate();

  const items = userRole === 'student' ? studentItems : userRole === 'parent' ? parentItems : adminItems;
  const isCollapsed = state === 'collapsed';

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'parent': return 'bg-secondary text-secondary-foreground';
      case 'student': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <SidebarUI className={isCollapsed ? 'w-14' : 'w-60'} collapsible="icon">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <Wallet className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold text-primary">EduPay</span>
            </div>
          )}
          <SidebarTrigger />
        </div>
        
        {!isCollapsed && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <Badge className={`${getRoleBadgeColor()} text-xs mt-1`}>
                  {userRole?.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{!isCollapsed && 'Navigation'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-accent'
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Logout</span>}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to logout? You'll need to sign in again to access your dashboard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Logout
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SidebarContent>
    </SidebarUI>
  );
};
