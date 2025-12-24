import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ScanSearch, 
  PlayCircle, 
  CheckCircle, 
  FileText, 
  Settings, 
  Command,
  Home,
  PanelLeftOpen,
  PanelLeftClose,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavIndicator {
  type: 'success' | 'warning' | 'info' | 'activity';
  tooltip?: string;
}

type PageType = 'overview' | 'capture' | 'apply' | 'verify' | 'report' | 'settings';
type UIMode = 'default' | 'advanced';

interface AppShellProps {
  children: ReactNode;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onOpenCommandPalette: () => void;
  pageTitle?: string;
  pageSubtitle?: string;
  actions?: ReactNode;
  navIndicators?: Partial<Record<'capture' | 'apply' | 'verify' | 'report', NavIndicator>>;
  uiMode: UIMode;
  onToggleUIMode: () => void;
}

export function AppShell({
  children,
  currentPage,
  onNavigate,
  onOpenCommandPalette,
  pageTitle,
  pageSubtitle,
  actions,
  navIndicators,
  uiMode,
  onToggleUIMode,
}: AppShellProps) {
  const showSidebar = uiMode === 'advanced';
  
  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: Home },
    { id: 'capture' as const, label: 'Capture computer', icon: ScanSearch },
    { id: 'apply' as const, label: 'Set up computer', icon: PlayCircle },
    { id: 'verify' as const, label: 'Check computer', icon: CheckCircle },
    { id: 'report' as const, label: 'Report', icon: FileText },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - conditionally rendered based on UI mode */}
      <AnimatePresence mode="wait">
        {showSidebar && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="border-r border-border bg-panel flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-border min-w-[256px]">
              <h1 className="text-xl font-semibold text-primary">Endstate</h1>
              <p className="text-xs text-muted-foreground mt-1">Setup Management</p>
            </div>
            
            <nav className="flex-1 p-4 space-y-1 min-w-[256px]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                const indicator = navIndicators?.[item.id as keyof typeof navIndicators];
                
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
                    title={indicator?.tooltip}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-primary/10 rounded-md"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className="h-4 w-4 relative z-10" />
                    <span className="relative z-10 flex-1 text-left">{item.label}</span>
                    {indicator && (
                      <span 
                        className={cn(
                          'w-2 h-2 rounded-full relative z-10',
                          indicator.type === 'success' && 'bg-success',
                          indicator.type === 'warning' && 'bg-warning',
                          indicator.type === 'info' && 'bg-primary',
                          indicator.type === 'activity' && 'bg-primary animate-pulse'
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
            
            {/* Mode toggle at bottom of sidebar */}
            <div className="p-4 border-t border-border min-w-[256px]">
              <button
                onClick={onToggleUIMode}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent/10 hover:text-foreground transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                <span>Switch to Default mode</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-panel px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Sidebar toggle for default mode */}
            {!showSidebar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleUIMode}
                className="gap-2"
                title="Show navigation (Advanced mode)"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}
            {showSidebar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleUIMode}
                className="gap-2"
                title="Hide navigation (Default mode)"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
            <div>
              {pageTitle && (
                <h2 className="text-lg font-semibold">{pageTitle}</h2>
              )}
              {pageSubtitle && (
                <p className="text-xs text-muted-foreground">{pageSubtitle}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {actions}
            {/* Command palette button - de-emphasized in Default mode */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCommandPalette}
              className={cn(
                "gap-2",
                !showSidebar && "opacity-50 hover:opacity-100"
              )}
              title="Command palette (Ctrl+K)"
            >
              <Command className="h-4 w-4" />
              {showSidebar && (
                <span className="text-xs text-muted-foreground">Ctrl+K</span>
              )}
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
