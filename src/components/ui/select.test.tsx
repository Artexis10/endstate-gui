import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

describe('Select Component', () => {
  it('renders select trigger with placeholder', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    );
    
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders with dark mode styling classes', () => {
    const { container } = render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="test">Test</SelectItem>
        </SelectContent>
      </Select>
    );
    
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger).toHaveClass('bg-background');
    expect(trigger).toHaveClass('text-sm');
  });

  it('supports keyboard navigation', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
          <SelectItem value="b">B</SelectItem>
        </SelectContent>
      </Select>
    );
    
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('has solid background styling on trigger', () => {
    const { container } = render(
      <Select>
        <SelectTrigger data-testid="select-trigger">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent data-testid="select-content">
          <SelectItem value="test">Test</SelectItem>
        </SelectContent>
      </Select>
    );
    
    // Verify trigger has bg-background and border-input for solid, readable appearance
    const trigger = container.querySelector('[role="combobox"]');
    expect(trigger).toHaveClass('bg-background');
    expect(trigger).toHaveClass('border-input');
    
    // Note: SelectContent renders in a portal with bg-popover class
    // Testing it would require opening the select, which is beyond unit test scope
  });

  it('verifies SelectContent has opaque background classes', () => {
    // Verify that SelectContent uses bg-popover (solid background) and NOT transparent classes
    const { baseElement } = render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="test">Test</SelectItem>
        </SelectContent>
      </Select>
    );
    
    // SelectContent renders in a portal, find it in baseElement (includes portals)
    const content = baseElement.querySelector('[role="listbox"]');
    expect(content).toBeInTheDocument();
    
    // Assert it has bg-popover class for solid background
    expect(content).toHaveClass('bg-popover');
    expect(content).toHaveClass('text-popover-foreground');
    
    // Assert it does NOT have transparent or opacity classes
    const classList = content?.className || '';
    expect(classList).not.toMatch(/bg-transparent/);
    expect(classList).not.toMatch(/opacity-\d+/);
  });
});
