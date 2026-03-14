import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Tag,
  Send,
  DollarSign,
  Settings,
  LogOut,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAuthStore } from '@/src/store/auth';
import { signOut } from '@/src/lib/auth';

const navItems = [
  { label: 'Copiloto',      icon: Sparkles,        href: '/copiloto' },
  { label: 'Dashboard',     icon: LayoutDashboard, href: '/dashboard' },
  { label: 'WhatsApp',      icon: MessageSquare,   href: '/whatsapp' },
  { label: 'Grupos',        icon: Users,           href: '/groups' },
  { label: 'Promoções',     icon: Tag,             href: '/promos' },
  { label: 'Disparos',      icon: Send,            href: '/dispatches' },
  { label: 'Comissões',     icon: DollarSign,      href: '/commissions' },
  { label: 'Configurações', icon: Settings,        href: '/settings' },
];

// Mobile: max 5 itens (Home, Promos, Disparos, WhatsApp, Config)
const mobileNavItems = [
  { label: 'Home',      icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Promos',    icon: Tag,             href: '/promos' },
  { label: 'Disparos',  icon: Send,            href: '/dispatches' },
  { label: 'WhatsApp',  icon: MessageSquare,   href: '/whatsapp' },
  { label: 'Config',    icon: Settings,        href: '/settings' },
];

export function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    clearAuth();
    navigate('/login');
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-border/50 bg-card md:block">
        <div className="flex h-full flex-col p-4">

          {/* logo */}
          <div className="flex items-center gap-2 px-2 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Dispara</span>
          </div>

          {/* nav */}
          <nav className="mt-6 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* user */}
          <div className="mt-auto flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
              <Avatar className="h-9 w-9 border border-primary/20">
                <AvatarImage src={user?.user_metadata?.avatar_url ?? undefined} />
                <AvatarFallback>{(user?.user_metadata?.full_name ?? user?.email)?.charAt(0) ?? 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium">{user?.user_metadata?.full_name ?? 'Usuário'}</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email ?? ''}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="justify-start gap-3 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              Sair
            </Button>
          </div>

        </div>
      </aside>

      {/* Mobile bottom navigation — 5 itens, 44px tap targets, safe-area */}
      <nav className="fixed bottom-0 left-0 z-40 flex w-full items-end justify-around border-t border-border/50 bg-card/95 backdrop-blur-md md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex min-h-[56px] min-w-[48px] flex-col items-center justify-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:scale-95 active:text-primary',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn('rounded-full px-4 py-1 transition-colors', isActive && 'bg-primary/15')}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
