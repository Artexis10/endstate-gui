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

export function RenameFileModal({
  open,
  onOpenChange,
  currentFilename,
  onConfirm,
}: RenameFileModalProps) {
  const [newFilename, setNewFilename] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNewFilename(currentFilename);
      setError('');
    }
  }, [open, currentFilename]);

  const getExtension = (filename: string): string => {
    const match = filename.match(/\.(jsonc?|json5)$/i);
    return match ? match[0] : '.json';
  };

  const handleConfirm = () => {
    const trimmed = newFilename.trim();
    if (!trimmed) {
      setError('Filename cannot be empty');
      return;
    }

    if (trimmed === currentFilename) {
      setError('New filename is the same as current filename');
      return;
    }

    const currentExt = getExtension(currentFilename);
    const newExt = getExtension(trimmed);
    
    if (newExt !== currentExt) {
      setError(`Extension must remain ${currentExt}`);
      return;
    }

    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
          <DialogDescription>
            Rename the manifest file on disk. The metadata file will be renamed automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="new-filename" className="text-sm font-medium">
              New filename
            </label>
            <Input
              id="new-filename"
              value={newFilename}
              onChange={(e) => {
                setNewFilename(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirm();
                }
              }}
              placeholder="profile-name.json"
              className="mt-1"
            />
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
