import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Search, X } from 'lucide-react';
import { copyText } from '@/lib/clipboard';

interface LogViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logContent: string;
  title?: string;
  isLoading?: boolean;
  error?: string | null;
}

export function LogViewerModal({
  open,
  onOpenChange,
  logContent,
  title = 'Log Viewer',
  isLoading = false,
  error = null,
}: LogViewerModalProps) {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Reset copied state when modal closes
  useEffect(() => {
    if (!open) {
      setCopied(false);
      setSearchTerm('');
    }
  }, [open]);

  const handleCopy = async () => {
    try {
      await copyText(logContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const filteredLogs = searchTerm
    ? logContent
        .split('\n')
        .filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
        .join('\n')
    : logContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col" data-testid="log-viewer-modal">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>{title}</DialogTitle>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              disabled={isLoading || !!error || !logContent}
              className="gap-2"
              data-testid="log-viewer-copy"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-shrink-0 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
            data-testid="log-viewer-search"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Loading log content...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32 text-destructive">
              {error}
            </div>
          ) : (
            <pre
              className="bg-muted/50 rounded-md border border-border p-3 text-xs font-mono overflow-auto whitespace-pre-wrap break-words min-h-[200px] max-h-[50vh]"
              data-testid="log-viewer-content"
            >
              {filteredLogs || (
                <span className="text-muted-foreground italic">No log content</span>
              )}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
