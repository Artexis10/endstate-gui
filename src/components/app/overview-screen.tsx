/**
 * Overview (Home) Screen - The default landing page for Endstate
 * 
 * This screen integrates the lifecycle conceptually by surfacing:
 * - Primary actions (Capture, Set up, Check)
 * - Current profile (if any)
 * - Recent lifecycle activity
 * 
 * Non-technical users should be able to complete core tasks
 * without ever needing to navigate away from this screen.
 */

import { motion } from 'framer-motion';
import { 
  ScanSearch, 
  PlayCircle, 
  CheckCircle,
  ChevronRight,
  Clock,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime, type LifecycleState } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';

interface OverviewScreenProps {
  lifecycleState: LifecycleState;
  selectedProfile: string;
  profiles: DiscoveredProfile[];
  isRunning: boolean;
  onNavigate: (page: 'capture' | 'apply' | 'verify' | 'report' | 'settings') => void;
  onCapture: () => void;
  onSetup: () => void;
  onCheck: () => void;
  onProfileChange: (profile: string, path: string) => void;
}

export function OverviewScreen({
  lifecycleState,
  selectedProfile,
  profiles,
  isRunning,
  onNavigate,
  onCapture,
  onSetup,
  onCheck,
  onProfileChange,
}: OverviewScreenProps) {
  const hasProfile = !!selectedProfile && profiles.length > 0;
  
  const recentActivity = [
    lifecycleState.lastCapture && {
      type: 'capture' as const,
      label: 'Captured computer',
      timestamp: lifecycleState.lastCapture.timestamp,
      success: lifecycleState.lastCapture.success,
      summary: lifecycleState.lastCapture.summary?.total 
        ? `${lifecycleState.lastCapture.summary.total} apps`
        : undefined,
    },
    lifecycleState.lastPreview && {
      type: 'preview' as const,
      label: 'Previewed setup',
      timestamp: lifecycleState.lastPreview.timestamp,
      success: lifecycleState.lastPreview.success,
      profile: lifecycleState.lastPreview.profile,
      summary: lifecycleState.lastPreview.summary?.installed !== undefined
        ? `${lifecycleState.lastPreview.summary.installed} to install`
        : undefined,
    },
    lifecycleState.lastApply && {
      type: 'apply' as const,
      label: 'Applied setup',
      timestamp: lifecycleState.lastApply.timestamp,
      success: lifecycleState.lastApply.success,
      profile: lifecycleState.lastApply.profile,
      summary: lifecycleState.lastApply.summary?.installed !== undefined
        ? `${lifecycleState.lastApply.summary.installed} installed`
        : undefined,
    },
    lifecycleState.lastVerify && {
      type: 'verify' as const,
      label: 'Checked computer',
      timestamp: lifecycleState.lastVerify.timestamp,
      success: lifecycleState.lastVerify.success,
      profile: lifecycleState.lastVerify.profile,
      summary: lifecycleState.lastVerify.summary?.missing !== undefined && lifecycleState.lastVerify.summary.missing > 0
        ? `${lifecycleState.lastVerify.summary.missing} missing`
        : lifecycleState.lastVerify.summary?.alreadyPresent !== undefined
          ? `${lifecycleState.lastVerify.summary.alreadyPresent} present`
          : undefined,
    },
  ].filter(Boolean).sort((a, b) => 
    new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime()
  ).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Endstate</h1>
        <p className="text-muted-foreground">
          Capture, apply, and verify your computer setup
        </p>
      </div>

      {/* Current Profile Card (if any) */}
      {hasProfile && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Current Profile</p>
                  <p className="text-xs text-muted-foreground">{selectedProfile}</p>
                </div>
              </div>
              <select
                value={selectedProfile}
                onChange={(e) => {
                  const selected = profiles.find(p => p.name === e.target.value);
                  onProfileChange(e.target.value, selected?.path || '');
                }}
                disabled={isRunning}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Capture */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card 
            className="cursor-pointer hover:border-primary/50 transition-colors h-full"
            onClick={() => !isRunning && onCapture()}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <ScanSearch className="h-5 w-5 text-blue-500" />
                </div>
                <CardTitle className="text-base">Capture computer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Save your current setup as a reusable profile
              </CardDescription>
            </CardContent>
          </Card>
        </motion.div>

        {/* Set up */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card 
            className={`cursor-pointer hover:border-primary/50 transition-colors h-full ${!hasProfile ? 'opacity-60' : ''}`}
            onClick={() => !isRunning && hasProfile && onSetup()}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <PlayCircle className="h-5 w-5 text-green-500" />
                </div>
                <CardTitle className="text-base">Set up computer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {hasProfile 
                  ? 'Install apps from your saved profile'
                  : 'Capture a profile first to get started'
                }
              </CardDescription>
            </CardContent>
          </Card>
        </motion.div>

        {/* Check */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card 
            className={`cursor-pointer hover:border-primary/50 transition-colors h-full ${!hasProfile ? 'opacity-60' : ''}`}
            onClick={() => !isRunning && hasProfile && onCheck()}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <CheckCircle className="h-5 w-5 text-amber-500" />
                </div>
                <CardTitle className="text-base">Check computer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {hasProfile 
                  ? 'Verify your setup matches the profile'
                  : 'Capture a profile first to get started'
                }
              </CardDescription>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* No Profile Prompt */}
      {!hasProfile && profiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              No setup profiles found. Start by capturing your current computer setup.
            </p>
            <Button onClick={onCapture} disabled={isRunning}>
              <ScanSearch className="h-4 w-4 mr-2" />
              Capture computer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
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
              {recentActivity.map((activity) => (
                <div 
                  key={`${activity!.type}-${activity!.timestamp}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity!.success ? 'bg-success' : 'bg-warning'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">{activity!.label}</p>
                      {activity!.profile && (
                        <p className="text-xs text-muted-foreground">{activity!.profile}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity!.timestamp)}
                    </p>
                    {activity!.summary && (
                      <p className="text-xs font-medium">{activity!.summary}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
