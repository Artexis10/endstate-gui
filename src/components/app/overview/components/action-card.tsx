/**
 * ActionCard - Generic expandable card wrapper for action cards
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import { getExpandCollapseVariants, getLayoutTransition } from '@/lib/motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ActionType } from '../types';

interface ActionCardProps {
  action: NonNullable<ActionType>;
  expanded: boolean;
  disabled: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: 'blue' | 'green' | 'amber';
  testId: string;
  cardRef?: React.RefObject<HTMLDivElement>;
  collapsedStatusSlot?: React.ReactNode;
  expandedStatusSlot?: React.ReactNode;
  expandedContentTestId: string;
  onToggle: () => void;
  children: React.ReactNode;
}

const accentClasses = {
  blue: {
    expanded: 'border-l-blue-500 border-blue-500/50 shadow-md',
    collapsed: 'border-l-blue-500/50 hover:border-l-blue-500 hover:border-primary/30',
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-500',
  },
  green: {
    expanded: 'border-l-green-500 border-green-500/50 shadow-md',
    collapsed: 'border-l-green-500/50 hover:border-l-green-500 hover:border-primary/30',
    iconBg: 'bg-green-500/10',
    iconText: 'text-green-500',
  },
  amber: {
    expanded: 'border-l-amber-500 border-amber-500/50 shadow-md',
    collapsed: 'border-l-amber-500/50 hover:border-l-amber-500 hover:border-primary/30',
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-500',
  },
};

export function ActionCard({
  expanded,
  disabled,
  title,
  description,
  icon,
  accentColor,
  testId,
  cardRef,
  collapsedStatusSlot,
  expandedStatusSlot,
  expandedContentTestId,
  onToggle,
  children,
}: ActionCardProps) {
  const expandCollapseVariants = getExpandCollapseVariants();
  const layoutTransition = getLayoutTransition();
  const accent = accentClasses[accentColor];

  return (
    <motion.div layout transition={layoutTransition} ref={cardRef}>
      <Card 
        data-testid={testId}
        className={`cursor-pointer transition-all duration-200 border-l-2 ${
          expanded ? accent.expanded : accent.collapsed
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={onToggle}
      >
        <CardHeader>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${accent.iconBg}`}>
                  {icon}
                </div>
                <div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {description}
                  </CardDescription>
                </div>
              </div>
              <motion.div
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </div>
          </div>
          {/* Collapsed status strip - visible when card is collapsed with result state */}
          {!expanded && collapsedStatusSlot}
        </CardHeader>
        
        {/* Static status strip slot - outside animated region to prevent jumpiness */}
        {expanded && expandedStatusSlot}
        
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key={`${testId}-content`}
              variants={expandCollapseVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
            >
              <CardContent className="pt-0 pb-4" data-testid={expandedContentTestId}>
                {children}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
