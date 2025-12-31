import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2 } from 'lucide-react';
import { profileBasenameSchema, getExtension, getBasename, type ValidExtension } from '@/lib/filename-validation';
import { invoke } from '@/lib/tauri-bridge';

interface RenameFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilename: string;
  currentDirectory: string;
  onConfirm: (newFilename: string) => void;
}

export function RenameFileModal({
  open,
  onOpenChange,
  currentFilename,
  currentDirectory,
  onConfirm,
}: RenameFileModalProps) {
  const [basename, setBasename] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  
  // Extract extension once - it's fixed and cannot be changed
  const extension: ValidExtension = getExtension(currentFilename);

  useEffect(() => {
    if (open) {
      setBasename(getBasename(currentFilename));
      setError('');
    }
  }, [open, currentFilename]);

  const handleConfirm = async () => {
    const trimmed = basename.trim();
    
    // Validate using shared Zod schema
    const result = profileBasenameSchema.safeParse(trimmed);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    const newFilename = trimmed + extension;
    
    if (newFilename === currentFilename) {
      setError('New filename is the same as current filename');
      return;
    }

    // Check for collision
    setIsChecking(true);
    try {
      const newPath = `${currentDirectory}\\${newFilename}`;
      const exists = await invoke<boolean>('check_file_exists', { path: newPath });
      if (exists) {
        setError('A file with this name already exists');
        setIsChecking(false);
        return;
      }
    } catch (err) {
      // In web mode, skip collision check and proceed
      console.debug('Collision check skipped (web mode):', err);
    }
    setIsChecking(false);

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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isChecking}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isChecking}>
            {isChecking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking...</> : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
