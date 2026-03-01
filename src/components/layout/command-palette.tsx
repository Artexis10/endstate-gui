import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Settings,
  FolderOpen,
  Home,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: 'navigate' | 'action';
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (page: 'landing' | 'report' | 'settings') => void;
  onOpenLogsFolder?: () => void;
  onOpenOutputFolder?: () => void;
  onUndoSettings?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onOpenLogsFolder,
  onOpenOutputFolder,
  onUndoSettings,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: Command[] = [
    {
      id: 'nav-home',
      label: 'Go to Home',
      icon: Home,
      action: () => {
        onNavigate('landing');
        onOpenChange(false);
      },
      category: 'navigate',
    },
    {
      id: 'nav-report',
      label: 'Go to Reports',
      icon: FileText,
      action: () => {
        onNavigate('report');
        onOpenChange(false);
      },
      category: 'navigate',
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: Settings,
      action: () => {
        onNavigate('settings');
        onOpenChange(false);
      },
      category: 'navigate',
    },
  ];

  if (onOpenLogsFolder) {
    commands.push({
      id: 'open-logs',
      label: 'Open Logs Folder',
      icon: FolderOpen,
      action: () => {
        onOpenLogsFolder();
        onOpenChange(false);
      },
      category: 'action',
    });
  }

  if (onOpenOutputFolder) {
    commands.push({
      id: 'open-output',
      label: 'Open Output Folder',
      icon: FolderOpen,
      action: () => {
        onOpenOutputFolder();
        onOpenChange(false);
      },
      category: 'action',
    });
  }

  if (onUndoSettings) {
    commands.push({
      id: 'undo-settings',
      label: 'Undo Settings Changes',
      icon: RotateCcw,
      action: () => {
        onUndoSettings();
        onOpenChange(false);
      },
      category: 'action',
    });
  }

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredCommands]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <Input
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 text-base h-12"
            autoFocus
          />
        </DialogHeader>
        
        <div className="max-h-[400px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((cmd, index) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                      index === selectedIndex
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-accent/10'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{cmd.label}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {cmd.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
