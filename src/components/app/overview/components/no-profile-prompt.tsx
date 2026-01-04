/**
 * NoProfilePrompt - Shown when no profiles exist
 */

import { ScanSearch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface NoProfilePromptProps {
  isRunning: boolean;
  onCapture: () => void;
}

export function NoProfilePrompt({ isRunning, onCapture }: NoProfilePromptProps) {
  return (
    <Card className="border-dashed" data-testid="no-profile-prompt">
      <CardContent className="py-6 text-center" data-testid="no-profile-card-content">
        <p className="text-sm text-muted-foreground mb-4">
          No setup profiles found. Start by capturing your current computer setup.
        </p>
        <Button onClick={onCapture} disabled={isRunning}>
          <ScanSearch className="h-4 w-4 mr-2" />
          Capture computer
        </Button>
      </CardContent>
    </Card>
  );
}
