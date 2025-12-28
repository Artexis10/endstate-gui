import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';

interface RenameFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilename: string;
  onConfirm: (newFilename: string) => void;
}

/**
 * Extract extension from filename (.json, .jsonc, .json5)
 */
function getExtension(filename: string): string {
  const match = filename.match(/\.(jsonc|json5|json)$/i);
  return match ? match[0] : '.json';
}

/**
 * Extract basename (filename without extension)
 */
function getBasename(filename: string): string {
  return filename.replace(/\.(jsonc|json5|json)$/i, '');
}

export function RenameFileModal({
  open,
  onOpenChange,
  currentFilename,
  onConfirm,
}: RenameFileModalProps) {
  const [basename, setBasename] = useState('');
  const [error, setError] = useState('');
  
  // Extract extension once - it's fixed and cannot be changed
  const extension = getExtension(currentFilename);

  useEffect(() => {
    if (open) {
      setBasename(getBasename(currentFilename));
      setError('');
    }
  }, [open, currentFilename]);

  const handleConfirm = () => {
    const trimmed = basename.trim();
    
    // Validation: basename must be non-empty
    if (!trimmed) {
      setError('Filename cannot be empty');
      return;
    }

    // Validation: basename must not contain dots (prevents extension changes)
    if (trimmed.includes('.')) {
      setError('Filename cannot contain dots');
      return;
    }

    const newFilename = trimmed + extension;
    
    if (newFilename === currentFilename) {
      setError('New filename is the same as current filename');
      return;
    }

    onConfirm(newFilename);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change filename</DialogTitle>
          <DialogDescription>
            Change the manifest filename on disk. The metadata file will be renamed automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="new-basename" className="text-sm font-medium">
              New filename
            </label>
            <div className="flex items-center gap-0 mt-1">
              <Input
                id="new-basename"
                value={basename}
                onChange={(e) => {
                  setBasename(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirm();
                  }
                }}
                placeholder="profile-name"
                className="rounded-r-none border-r-0"
              />
              <span className="inline-flex items-center px-3 h-10 border border-input bg-muted text-muted-foreground text-sm rounded-r-md">
                {extension}
              </span>
            </div>
            {error && (
              <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>

          <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
            <strong>Current:</strong> {currentFilename}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
