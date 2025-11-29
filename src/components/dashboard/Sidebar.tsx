import { LayoutDashboard, Wallet, History, User, Settings, LogOut, Menu, Upload, Webhook, GitCompare, FlaskConical } from 'lucide-react';
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
  { title: 'Payment Simulator', url: '/dashboard/admin/payment-simulator', icon: FlaskConical },
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
    navigate('/');
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
    <SidebarUI className={isCollapsed ? 'w-14' : 'w-64'} collapsible="icon">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">EduPay</span>
            </div>
          )}
          {isCollapsed && (
            <div className="p-1.5 rounded-lg bg-primary/10 mx-auto">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>
        
        {!isCollapsed && (
          <div className="mt-4 p-3 rounded-lg bg-sidebar-accent border border-sidebar-border shadow-sm">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-sidebar-foreground">
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

      <SidebarContent className="bg-sidebar">
        <SidebarGroup className="px-2 py-4">
          {!isCollapsed && (
            <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground px-3 mb-2">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-sidebar-primary pl-3 transition-smooth'
                          : 'hover:bg-sidebar-accent/50 text-sidebar-foreground transition-smooth pl-3.5'
                      }
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t border-sidebar-border bg-sidebar">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 transition-smooth"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span className="ml-3">Logout</span>}
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
