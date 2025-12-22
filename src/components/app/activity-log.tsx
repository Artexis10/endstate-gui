import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogViewer } from './log-viewer';
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ActivityItem {
  id: string;
  message: string;
  status: 'running' | 'success' | 'error';
  timestamp: Date;
}

interface ActivityLogProps {
  activities: ActivityItem[];
  technicalLogs: string;
  logsTruncated?: boolean;
  onClearLogs?: () => void;
}

export function ActivityLog({ activities, technicalLogs, logsTruncated, onClearLogs }: ActivityLogProps) {
  const [showTechnical, setShowTechnical] = useState(() => {
    const saved = localStorage.getItem('autosuite-show-technical-logs');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('autosuite-show-technical-logs', String(showTechnical));
  }, [showTechnical]);

  const getStatusIcon = (status: ActivityItem['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-danger" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simple activity list */}
        {activities.length > 0 ? (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5">{getStatusIcon(activity.status)}</div>
                <div className="flex-1">
                  <p className="text-foreground">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No recent activity</p>
        )}

        {/* Technical details disclosure */}
        {technicalLogs && (
          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showTechnical ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Technical details
            </button>
            
            {showTechnical && (
              <div className="mt-3">
                <LogViewer
                  logs={technicalLogs}
                  truncated={logsTruncated}
                  onClear={onClearLogs}
                  title=""
                  showControls={true}
                  className="border-0"
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
