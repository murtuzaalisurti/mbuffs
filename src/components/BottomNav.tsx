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
  const activeIndex = getActiveTabIndex(location.pathname);

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
      className="fixed inset-x-4 z-40 md:hidden"
      // Its own transition group keeps the bar still while pages cross-fade beneath it
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))', viewTransitionName: 'bottom-nav' }}
      aria-label="Primary"
    >
      <ul className="glass relative mx-auto flex h-14 max-w-md items-stretch rounded-full p-1 ring-1 ring-border shadow-[0_12px_40px_-12px_rgb(0_0_0/0.7)]">
        {/* Sliding indicator: tabs are equal width, so it moves in whole-tab steps */}
        <li
          aria-hidden
          role="presentation"
          className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-primary/12 transition-[translate,opacity] duration-(--dur-scene) ease-(--ease-emph)"
          style={{
            width: `calc((100% - 0.5rem) / ${tabs.length})`,
            translate: `${Math.max(activeIndex, 0) * 100}% 0`,
            opacity: activeIndex === -1 ? 0 : 1,
          }}
        />
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = index === activeIndex;

          if (tab.action === 'search') {
            return (
              <li key={tab.label} className="relative flex-1">
                <button
                  type="button"
                  onClick={handleSearchClick}
                  className={tabClass(false)}
                  aria-label={tab.label}
                >
                  <TabContent icon={<Icon className="h-5 w-5" />} label={tab.label} isActive={false} />
                </button>
              </li>
            );
          }

          if (tab.action === 'profile-menu') {
            return (
              <li key={tab.label} className="relative flex-1">
                <Popover open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        haptics.trigger('medium');
                      }}
                      className={tabClass(isOnProfilePage)}
                      aria-label={tab.label}
                    >
                      <TabContent
                        icon={avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className={`h-5 w-5 rounded-full object-cover ${isOnProfilePage ? 'ring-2 ring-primary' : ''}`}
                          />
                        ) : (
                          <Icon className="h-5 w-5" strokeWidth={isOnProfilePage ? 2.25 : 2} />
                        )}
                        label={tab.label}
                        isActive={isOnProfilePage}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" sideOffset={14} className="w-48 p-1.5">
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
            <li key={tab.label} className="relative flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                onClick={handleTabClick(tab.to)}
                className={tabClass(isActive)}
                aria-label={tab.label}
                viewTransition
              >
                <TabContent
                  icon={<Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} />}
                  label={tab.label}
                  isActive={isActive}
                />
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

function getActiveTabIndex(pathname: string) {
  if (pathname === '/') return 0;
  if (pathname.startsWith('/categories')) return 1;
  if (pathname.startsWith('/collection')) return 3;
  if (pathname === '/profile') return 4;
  return -1;
}

function tabClass(isActive: boolean) {
  return `flex h-full w-full items-center justify-center rounded-full transition-[color,scale] duration-(--dur-fast) active:scale-90 ${
    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
  }`;
}

/** Icon sits centred; when the tab is active it lifts and its label rises in beneath it. */
function TabContent({ icon, label, isActive }: { icon: React.ReactNode; label: string; isActive: boolean }) {
  return (
    <span className="relative flex flex-col items-center">
      <span className={`transition-[translate] duration-(--dur-ui) ease-(--ease-emph) ${isActive ? '-translate-y-1.5' : 'translate-y-0'}`}>
        {icon}
      </span>
      <span
        aria-hidden
        className={`absolute top-full -mt-1 whitespace-nowrap text-[10px] font-medium transition-[opacity,translate] duration-(--dur-ui) ease-(--ease-emph) ${
          isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
        }`}
      >
        {label}
      </span>
    </span>
  );
}
