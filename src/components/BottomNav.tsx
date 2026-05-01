import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, Search, List, User, Shield, LogOut, type LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/hooks/useAuth';
import { fetchCurrentUserApi } from '@/lib/api';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const HIDDEN_PATHS = ['/login'];

type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  action?: 'search' | 'profile-menu';
};

const tabs: Tab[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: 'search', label: 'Search', icon: Search, action: 'search' },
  { to: '/collections', label: 'Collections', icon: List },
  { to: '/profile', label: 'Profile', icon: User, action: 'profile-menu' },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { data: meData } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: fetchCurrentUserApi,
    enabled: !!user,
  });
  const avatarUrl = meData?.user?.avatarUrl || meData?.user?.image || user?.avatarUrl || user?.image || undefined;
  const isOnProfilePage = location.pathname === '/profile';

  if (HIDDEN_PATHS.some((path) => location.pathname.startsWith(path))) {
    return null;
  }

  const handleSearchClick = (event: React.MouseEvent) => {
    event.preventDefault();
    haptics.trigger('medium');
    window.dispatchEvent(new Event('open-search'));
  };

  const handleTabClick = (targetPath: string) => () => {
    if (location.pathname !== targetPath) {
      haptics.trigger('selection');
    }
  };

  const handleMenuNavigate = (path: string) => {
    setProfileMenuOpen(false);
    haptics.trigger('selection');
    navigate(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.action === 'search') {
            return (
              <li key={tab.label} className="flex-1">
                <button
                  type="button"
                  onClick={handleSearchClick}
                  className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              </li>
            );
          }

          if (tab.action === 'profile-menu') {
            return (
              <li key={tab.label} className="flex-1">
                <Popover open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        haptics.trigger('medium');
                      }}
                      className={`flex h-full w-full flex-col items-center justify-center gap-1 transition-colors active:scale-95 ${
                        isOnProfilePage ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className={`h-5 w-5 rounded-full object-cover ${isOnProfilePage ? 'ring-2 ring-foreground' : ''}`}
                        />
                      ) : (
                        <Icon className="h-5 w-5" strokeWidth={isOnProfilePage ? 2.25 : 2} />
                      )}
                      <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" sideOffset={12} className="w-48 p-1.5">
                    <button
                      type="button"
                      onClick={() => handleMenuNavigate('/profile')}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                    >
                      <User className="h-4 w-4" />
                      <span>Profile</span>
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleMenuNavigate('/admin')}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Admin</span>
                      </button>
                    )}
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        haptics.trigger('medium');
                        logout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </PopoverContent>
                </Popover>
              </li>
            );
          }

          return (
            <li key={tab.label} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                onClick={handleTabClick(tab.to)}
                className={({ isActive }) =>
                  `flex h-full w-full flex-col items-center justify-center gap-1 transition-colors active:scale-95 ${
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} />
                    <span className="text-[10px] font-medium">{tab.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
