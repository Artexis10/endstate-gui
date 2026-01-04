/**
 * RecentActivityCard - Displays recent lifecycle activity
 */

import { Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/lifecycle-state';

interface ActivityItem {
  type: 'capture' | 'preview' | 'apply' | 'verify';
  label: string;
  timestamp: string;
  success: boolean;
  profile?: string;
  summary?: string;
}

interface RecentActivityCardProps {
  activities: ActivityItem[];
  onNavigate: (page: 'report' | 'settings') => void;
}

export function RecentActivityCard({ activities, onNavigate }: RecentActivityCardProps) {
  if (activities.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recent Activity
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => onNavigate('report')}
          >
            View all
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activities.map((activity) => (
            <div 
              key={`${activity.type}-${activity.timestamp}`}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  activity.success ? 'bg-success' : 'bg-warning'
                }`} />
                <div>
                  <p className="text-sm font-medium">{activity.label}</p>
                  {activity.profile && (
                    <p className="text-xs text-muted-foreground">{activity.profile}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(activity.timestamp)}
                </p>
                {activity.summary && (
                  <p className="text-xs font-medium">{activity.summary}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
