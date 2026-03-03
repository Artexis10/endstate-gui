import { ReactNode } from 'react';
import markUrl from '../../../assets/brand/taskbar-icon-115-sw5.svg?url';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Settings, 
  Command,
  Home,
  PanelLeftOpen,
  PanelLeftClose,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavIndicator {
  type: 'success' | 'warning' | 'info' | 'activity';
  tooltip?: string;
}

type PageType = 'landing' | 'save' | 'setup' | 'report' | 'settings';

interface AppShellProps {
  children: ReactNode;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onOpenCommandPalette: () => void;
  pageTitle?: string;
  pageSubtitle?: string;
  actions?: ReactNode;
  navIndicators?: Partial<Record<'report', NavIndicator>>;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  previousPage?: PageType | null;
  onBack?: () => void;
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
  sidebarVisible,
  onToggleSidebar,
  previousPage,
  onBack,
}: AppShellProps) {
  // ADR-001: Intent pages (landing, save, setup) use full viewport — no sidebar or navigation chrome
  const isIntentPage = currentPage === 'landing' || currentPage === 'save' || currentPage === 'setup';
  const showSidebar = sidebarVisible && !isIntentPage;

  const navItems = [
    { id: 'landing' as const, label: 'Home', icon: Home },
    { id: 'report' as const, label: 'Reports', icon: FileText },
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
              <div className="flex items-center gap-3">
                <img src={markUrl} className="h-6 w-6 flex-shrink-0" alt="" aria-hidden="true" />
                <span className="text-xl font-semibold tracking-tight leading-none text-primary">Endstate</span>
              </div>
            </div>
            
            <nav className="flex-1 p-4 space-y-1 min-w-[256px]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                const indicator = navIndicators?.[item.id as keyof typeof navIndicators];
                
                return (
                  <button
                    key={item.id}
                    data-testid={`nav-${item.id}`}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative',
                      isActive
                        ? 'bg-primary/10 text-primary border-l-2 border-primary'
                        : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground border-l-2 border-transparent'
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
            
            {/* Spacer to keep sidebar layout balanced */}
            <div className="p-4 min-w-[256px]" />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar - hidden on landing page (ADR-001: full viewport, no chrome) */}
        {currentPage !== 'landing' && (
          <header className="h-16 border-b border-border bg-panel px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Back button - shown when navigated from Overview */}
              {!showSidebar && !isIntentPage && previousPage && onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="gap-2"
                  title="Back to Overview"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm">Back</span>
                </Button>
              )}
              {/* Sidebar toggle - only show for non-intent pages */}
              {!showSidebar && !isIntentPage && !previousPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleSidebar}
                  className="gap-2"
                  title="Show navigation"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              {showSidebar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleSidebar}
                  className="gap-2"
                  title="Hide navigation"
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
              {/* Settings access on intent flow pages */}
              {isIntentPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate('settings')}
                  className="gap-2"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              {/* Command palette button - de-emphasized in Default mode */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenCommandPalette}
                className="gap-2"
                title="Command palette (Ctrl+K)"
              >
                <Command className="h-4 w-4" />
                {showSidebar && (
                  <span className="text-xs text-muted-foreground">Ctrl+K</span>
                )}
              </Button>
            </div>
          </header>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className={isIntentPage ? 'max-w-4xl mx-auto p-6' : 'max-w-3xl mx-auto p-6'}>
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
