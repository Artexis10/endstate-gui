import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useShowDetails } from '@/lib/use-show-details';

interface DetailsDisclosureProps {
  /** Content to show when expanded */
  children: ReactNode;
  /** Label for the disclosure button (default: "Details") */
  title?: string;
  /** Additional className for the container */
  className?: string;
  /** Start expanded (default: false) */
  defaultExpanded?: boolean;
}

/**
 * A reusable disclosure component for showing technical details.
 * Only renders when the global "show details" setting is enabled.
 * 
 * When the setting is OFF: renders nothing (no label, no expander, no content).
 * When the setting is ON: renders a collapsible disclosure with the given title.
 */
export function DetailsDisclosure({
  children,
  title = 'Details',
  className = '',
  defaultExpanded = false,
}: DetailsDisclosureProps) {
  const showDetails = useShowDetails();
  const [expanded, setExpanded] = useState(defaultExpanded);

  // When setting is OFF, render nothing
  if (!showDetails) {
    return null;
  }

  return (
    <div className={className}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {title}
      </button>

      {expanded && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}
