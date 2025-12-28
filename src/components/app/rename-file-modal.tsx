import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';

/** Windows reserved device names (case-insensitive) */
const WINDOWS_RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
];

/** Characters not allowed in Windows filenames */
const WINDOWS_INVALID_CHARS = /[\\/:*?"<>|]/;

/** Zod schema for Windows-compatible filename basename */
export const basenameSchema = z.string()
  .min(1, 'Filename cannot be empty')
  .max(200, 'Filename is too long (max 200 characters)')
  .refine(
    (val) => !WINDOWS_INVALID_CHARS.test(val),
    'Filename cannot contain: \\ / : * ? " < > |'
  )
  .refine(
    (val) => !val.endsWith(' ') && !val.endsWith('.'),
    'Filename cannot end with a space or dot'
  )
  .refine(
    (val) => !WINDOWS_RESERVED_NAMES.includes(val.toUpperCase()),
    'This name is reserved by Windows'
  );

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
    
    // Validate using Zod schema
    const result = basenameSchema.safeParse(trimmed);
    if (!result.success) {
      setError(result.error.issues[0].message);
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
