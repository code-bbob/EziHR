'use client';

import { useRouter } from 'next/navigation';
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
import { Building2, LogOut, Settings, UserCircle, Calendar1Icon } from 'lucide-react';
import { Button } from './ui/button';
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

  return (
    <nav className="sticky top-0 py-2.5 z-50 w-full border-b border-border/90 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 max-w-7xl mx-auto w-full gap-3">
        <div className="mr-4 hidden md:flex items-center gap-3 min-w-0">
          <a href="/" className="mr-6 flex items-center space-x-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block tracking-tight text-lg">{title}</span>
          </a>
          {subtitle && <span className="hidden lg:inline-flex text-xs text-muted-foreground truncate">{subtitle}</span>}
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Can add global search here in the future */}
          </div>

          <div className="flex items-center space-x-2">
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
              className={`h-9 w-9 ${isRightOpen ? 'text-foreground' : 'text-muted-foreground'} hover:text-foreground hidden lg:flex`}
              title={isRightOpen ? 'Close calendar' : 'Open calendar'}
            >
              <Calendar1Icon className={`h-5 w-5 ${isRightOpen ? 'text-foreground' : ''}`} />
            </Button>

            {user && (
              <div className=''>
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none hover:opacity-80 transition-opacity">
                  <Avatar className="h-9 w-9 border border-border/50 cursor-pointer">
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
                        <p className="text-xs leading-none text-muted-foreground mt-1">
                          {typedUser?.email || roleStr}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
