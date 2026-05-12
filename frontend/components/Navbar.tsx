'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Calendar1Icon, LayoutDashboard, LogOut, Settings, Users, Menu } from 'lucide-react';
import { Button } from './ui/button';
import { SidebarTrigger } from './ui/sidebar';
import { useRightSidebar } from '@/hooks/useRightSidebar';

interface NavbarProps {
  title?: string;
  subtitle?: string;
  infoItems?: string[];
}

interface UserData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  employee_profile?: {
    avatar: string | null;
  } | null;
}


export function Navbar({ title = 'EziHR', subtitle, infoItems = [] }: NavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toggle: toggleRightSidebar, isOpen: isRightOpen } = useRightSidebar();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const typedUser = user as UserData | null;
  const displayName = typedUser?.first_name || typedUser?.username || 'User';
  const roleStr = typedUser?.is_admin ? 'Administrator' : 'Employee';
  const avatarUrl = typedUser?.employee_profile?.avatar;

  const isActiveRoute = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="sticky top-0 py-2.5 z-50 w-full border-b border-border/90 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="md:hidden">
            <SidebarTrigger aria-label="Toggle navigation" />
          </div>
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Building2 className="h-6 w-6 text-primary shrink-0" />
            <span className="font-bold tracking-tight text-base sm:text-lg truncate">{title}</span>
          </Link>
          <span className="hidden xl:inline-flex text-xs text-muted-foreground truncate">Welcome, {displayName}</span>
        </div>


        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <div className="hidden xl:flex items-center gap-2">
            {infoItems.slice(0, 3).map((item) => (
              <span key={item} className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                {item}
              </span>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRightSidebar}
            aria-pressed={isRightOpen}
            className={`hidden h-9 w-9 lg:inline-flex ${isRightOpen ? 'text-foreground' : 'text-muted-foreground'} hover:text-foreground`}
            title={isRightOpen ? 'Close calendar' : 'Open calendar'}
          >
            <Calendar1Icon className={`h-5 w-5 ${isRightOpen ? 'text-foreground' : ''}`} />
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none transition-opacity hover:opacity-80">
                <Avatar className="h-9 w-9 cursor-pointer border border-border/50">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      <p className="mt-1 text-xs leading-none text-muted-foreground">
                        {typedUser?.email || roleStr}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/')}>
                  <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
}
