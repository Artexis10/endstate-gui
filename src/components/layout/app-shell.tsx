import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { 
  ScanSearch, 
  PlayCircle, 
  CheckCircle, 
  FileText, 
  Settings, 
  Command 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AppShellProps {
  children: ReactNode;
  currentPage: 'capture' | 'apply' | 'verify' | 'report' | 'settings';
  onNavigate: (page: 'capture' | 'apply' | 'verify' | 'report' | 'settings') => void;
  onOpenCommandPalette: () => void;
  pageTitle?: string;
  pageSubtitle?: string;
  actions?: ReactNode;
}

export function AppShell({
  children,
  currentPage,
  onNavigate,
  onOpenCommandPalette,
  pageTitle,
  pageSubtitle,
  actions,
}: AppShellProps) {
  const navItems = [
    { id: 'capture' as const, label: 'Create setup', icon: ScanSearch },
    { id: 'apply' as const, label: 'Apply', icon: PlayCircle },
    { id: 'verify' as const, label: 'Verify', icon: CheckCircle },
    { id: 'report' as const, label: 'Report', icon: FileText },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-panel flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-semibold text-primary">Autosuite</h1>
          <p className="text-xs text-muted-foreground mt-1">Setup Management</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-primary/10 rounded-md"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-panel px-6 flex items-center justify-between">
          <div>
            {pageTitle && (
              <h2 className="text-lg font-semibold">{pageTitle}</h2>
            )}
            {pageSubtitle && (
              <p className="text-xs text-muted-foreground">{pageSubtitle}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {actions}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCommandPalette}
              className="gap-2"
            >
              <Command className="h-4 w-4" />
              <span className="text-xs text-muted-foreground">Ctrl+K</span>
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
