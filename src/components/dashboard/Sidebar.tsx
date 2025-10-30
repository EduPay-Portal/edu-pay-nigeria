import { LayoutDashboard, Wallet, History, User, Settings, LogOut, Menu } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
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
  { title: 'Settings', url: '/dashboard/admin/settings', icon: Settings },
];

export const Sidebar = () => {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const { data: userRole } = useUserRole();
  const navigate = useNavigate();

  const items = userRole === 'student' ? studentItems : userRole === 'parent' ? parentItems : adminItems;
  const isCollapsed = state === 'collapsed';

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <SidebarUI className={isCollapsed ? 'w-14' : 'w-60'} collapsible="icon">
      <div className="p-4 border-b flex items-center justify-between">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-primary">EduPay Connect</h2>
        )}
        <SidebarTrigger />
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
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Logout</span>}
          </Button>
        </div>
      </SidebarContent>
    </SidebarUI>
  );
};
