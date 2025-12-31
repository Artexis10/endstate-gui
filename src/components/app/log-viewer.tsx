import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMicroFeedback } from '@/lib/micro-feedback';
import { InlineFeedbackPopover } from '@/components/ui/inline-feedback-popover';
import { copyText } from '@/lib/clipboard';

interface LogViewerProps {
  logs: string;
  title?: string;
  className?: string;
  showControls?: boolean;
  onClear?: () => void;
  truncated?: boolean;
}

export function LogViewer({
  logs,
  title = 'Logs',
  className,
  showControls = true,
  onClear,
  truncated = false,
}: LogViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const logContainerRef = useRef<HTMLPreElement>(null);
  const copyFeedback = useMicroFeedback();

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopy = async () => {
    await copyFeedback.triggerAsync(
      () => copyText(logs),
      'Copied',
      'Copy failed'
    );
  };

  const filteredLogs = searchTerm
    ? logs
        .split('\n')
        .filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
        .join('\n')
    : logs;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {showControls && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={autoScroll}
                  onCheckedChange={(checked) => setAutoScroll(checked === true)}
                />
                Auto-scroll
              </label>
              <Button
                ref={copyFeedback.buttonRef}
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                title="Copy all"
                className="relative"
              >
                <Copy className="h-4 w-4" />
                <InlineFeedbackPopover feedback={copyFeedback.feedback} />
              </Button>
              {onClear && (
                <Button variant="ghost" size="icon" onClick={onClear} title="Clear">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        {showControls && (
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="pb-4">
        {truncated && (
          <div className="mb-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning-foreground">
            ⚠️ Output truncated (showing last 2MB)
          </div>
        )}
        <pre
          ref={logContainerRef}
          className="bg-background rounded-md border border-border p-3 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap break-words"
        >
          {filteredLogs || (
            <span className="text-muted-foreground italic">No logs yet...</span>
          )}
        </pre>
      </CardContent>
    </Card>
  );
}
