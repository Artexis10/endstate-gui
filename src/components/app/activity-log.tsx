import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogViewer } from './log-viewer';
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DetailsDisclosure } from '@/components/ui/details-disclosure';

interface ActivityItem {
  id: string;
  message: string;
  status: 'running' | 'success' | 'error';
  timestamp: Date;
  step?: number;
}

interface ActivityLogProps {
  activities: ActivityItem[];
  technicalLogs: string;
  logsTruncated?: boolean;
  onClearLogs?: () => void;
  isComplete?: boolean;
  totalAppsChecked?: number;
}

export function ActivityLog({ 
  activities, 
  technicalLogs, 
  logsTruncated, 
  onClearLogs,
  isComplete = false,
  totalAppsChecked = 0
}: ActivityLogProps) {
  const [showActivity, setShowActivity] = useState(true);

  const getStatusIcon = (status: ActivityItem['status']) => {
    switch (status) {
      case 'running':
        return (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success text-success-foreground">
            <CheckCircle2 className="h-3 w-3" />
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-danger text-danger-foreground">
            <AlertCircle className="h-3 w-3" />
          </div>
        );
    }
  };

  const hasActivity = activities.length > 0;

  return (
    <Card data-testid="activity-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Collapsed summary when complete */}
        {isComplete && hasActivity ? (
          <div>
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showActivity ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span>
                Scan completed • {totalAppsChecked} apps checked
              </span>
            </button>
            
            <AnimatePresence>
              {showActivity && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 mt-3 opacity-60">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 text-sm">
                        {activity.step && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">{activity.step}.</span>
                            {getStatusIcon(activity.status)}
                          </div>
                        )}
                        {!activity.step && (
                          <div className="mt-0.5">{getStatusIcon(activity.status)}</div>
                        )}
                        <div className="flex-1">
                          <p className="text-foreground">{activity.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : hasActivity ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-start gap-3 text-sm"
              >
                {activity.step && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{activity.step}.</span>
                    {getStatusIcon(activity.status)}
                  </div>
                )}
                {!activity.step && (
                  <div className="mt-0.5">{getStatusIcon(activity.status)}</div>
                )}
                <div className="flex-1">
                  <p className="text-foreground font-medium">{activity.message}</p>
                  {activity.step && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activity.status === 'running' ? 'In progress...' : 'Complete'}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No recent activity</p>
        )}

        {/* Details disclosure - only renders when setting is enabled */}
        {technicalLogs && (
          <DetailsDisclosure title="Details" className="pt-2 border-t border-border">
            <LogViewer
              logs={technicalLogs}
              truncated={logsTruncated}
              onClear={onClearLogs}
              title=""
              showControls={true}
              className="border-0"
            />
          </DetailsDisclosure>
        )}
      </CardContent>
    </Card>
  );
}
