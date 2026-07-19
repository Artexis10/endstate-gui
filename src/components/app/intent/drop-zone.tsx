/**
 * DropZone - File drop target for importing profiles (ADR-001)
 *
 * Accepts zip bundles and bare .jsonc manifest files.
 * Renders as a prominent drop area within the Set up flow.
 */

import { useState, useCallback, useEffect, useRef, type DragEvent } from 'react';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/motion';

const ACCEPTED_EXTENSIONS = ['.zip', '.json', '.jsonc', '.json5'];
const ACCEPTED_INPUT = ACCEPTED_EXTENSIONS.join(',');

interface DropZoneProps {
  onFileDrop: (files: File[]) => void;
  /** In Tauri mode, use a native dialog instead of HTML file input */
  onBrowse?: () => void;
  disabled?: boolean;
  /** Controlled native Tauri drag state. App owns the native listener. */
  nativeDragAccepted?: boolean;
}

interface NativeProfileDropFeedbackProps {
  visible: boolean;
}

export function NativeProfileDropFeedback({ visible }: NativeProfileDropFeedbackProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-x-6 bottom-6 z-50 flex items-center justify-center gap-2 rounded-xl border border-green-500/50 bg-background/95 px-5 py-4 text-sm font-medium text-green-500 shadow-lg backdrop-blur"
      role="status"
      data-testid="native-profile-drop-feedback"
    >
      <Upload className="h-4 w-4" aria-hidden="true" />
      Drop to import
    </motion.div>
  );
}

export function DropZone({
  onFileDrop,
  onBrowse,
  disabled = false,
  nativeDragAccepted = false,
}: DropZoneProps) {
  const [browserDragAccepted, setBrowserDragAccepted] = useState(false);
  const reduced = prefersReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDragOver = !disabled && (browserDragAccepted || nativeDragAccepted);

  useEffect(() => {
    if (disabled) setBrowserDragAccepted(false);
  }, [disabled]);

  const isAcceptedFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext));
  }, []);

  const hasAcceptedBrowserFile = useCallback((files?: FileList) => {
    if (!files) return true;
    const candidates = Array.from(files);
    // Some browsers hide file names until drop. Preserve their native hover
    // feedback when no inspectable files are exposed yet.
    return candidates.length === 0 || candidates.some(isAcceptedFile);
  }, [isAcceptedFile]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setBrowserDragAccepted(hasAcceptedBrowserFile(e.dataTransfer?.files));
    }
  }, [disabled, hasAcceptedBrowserFile]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setBrowserDragAccepted(hasAcceptedBrowserFile(e.dataTransfer?.files));
    }
  }, [disabled, hasAcceptedBrowserFile]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setBrowserDragAccepted(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setBrowserDragAccepted(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(isAcceptedFile);
    if (files.length > 0) {
      onFileDrop(files);
    }
  }, [disabled, isAcceptedFile, onFileDrop]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (onBrowse) {
      onBrowse();
    } else {
      fileInputRef.current?.click();
    }
  }, [disabled, onBrowse]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(isAcceptedFile);
    if (files.length > 0) {
      onFileDrop(files);
    }
    // Reset so the same file can be selected again
    e.target.value = '';
  }, [isAcceptedFile, onFileDrop]);

  return (
    <motion.div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      animate={isDragOver && !reduced ? { scale: 1.01 } : { scale: 1 }}
      transition={{ duration: 0.15 }}
      className={`relative flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-dashed transition-colors duration-200 ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-border'
          : isDragOver
            ? 'border-green-500 bg-green-500/5'
            : 'border-border hover:border-green-500/50 cursor-pointer'
      }`}
      data-testid="drop-zone"
      role="region"
      aria-label="Drop zone for profile import"
    >
      <div className={`p-3 rounded-xl transition-colors ${
        isDragOver ? 'bg-green-500/20' : 'bg-muted'
      }`}>
        <Upload className={`h-6 w-6 ${
          isDragOver ? 'text-green-500' : 'text-muted-foreground'
        }`} />
      </div>

      <div className="text-center">
        <p className={`text-sm font-medium ${
          isDragOver ? 'text-green-500' : 'text-foreground'
        }`}>
          {isDragOver ? 'Drop to import' : 'Click to browse or drop a file'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Accepts .zip bundles or .jsonc manifest files
        </p>
      </div>

      {/* eslint-disable-next-line react/forbid-elements -- hidden file picker; there is no shadcn file-input primitive */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_INPUT}
        onChange={handleFileInput}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
    </motion.div>
  );
}
