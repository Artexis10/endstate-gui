import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import '@testing-library/jest-dom/vitest';
import { RenameFileModal } from './rename-file-modal';

// Mock the tauri-bridge for collision checking
vi.mock('@/lib/tauri-bridge', () => ({
  invoke: vi.fn().mockResolvedValue(false), // Default: no collision
}));

/**
 * RenameFileModal UX Contract Tests
 * 
 * These tests verify the critical rename semantics:
 * - Extension cannot be edited (shown but fixed)
 * - Basename must be non-empty
 * - Basename can contain dots (allowed)
 * - Windows-invalid characters are rejected
 * - Windows reserved names are rejected
 * - Supports .json, .jsonc, .json5 extensions
 */

describe('RenameFileModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentFilename: 'my-profile.json',
    currentDirectory: 'C:\\profiles',
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Extension handling', () => {
    it('displays .json extension as non-editable', () => {
      render(<RenameFileModal {...defaultProps} currentFilename="profile.json" />);
      
      // Extension should be visible but in a separate element
      expect(screen.getByText('.json')).toBeInTheDocument();
      
      // Input should only contain basename
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('profile');
    });

    it('displays .jsonc extension as non-editable', () => {
      render(<RenameFileModal {...defaultProps} currentFilename="profile.jsonc" />);
      
      expect(screen.getByText('.jsonc')).toBeInTheDocument();
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('profile');
    });

    it('displays .json5 extension as non-editable', () => {
      render(<RenameFileModal {...defaultProps} currentFilename="profile.json5" />);
      
      expect(screen.getByText('.json5')).toBeInTheDocument();
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('profile');
    });

    it('preserves original extension in confirmed filename', async () => {
      const onConfirm = vi.fn();
      render(<RenameFileModal {...defaultProps} currentFilename="old.jsonc" onConfirm={onConfirm} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new-name' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('new-name.jsonc');
      });
    });
  });

  describe('Basename validation', () => {
    it('shows error when basename is empty', () => {
      render(<RenameFileModal {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      expect(screen.getByText('Filename cannot be empty')).toBeInTheDocument();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('allows dots in basename', async () => {
      const onConfirm = vi.fn();
      render(<RenameFileModal {...defaultProps} onConfirm={onConfirm} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'my.profile.name' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('my.profile.name.json');
      });
    });

    it('shows error when basename contains invalid characters', () => {
      render(<RenameFileModal {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'my<profile>name' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      // New validation uses stricter allowed chars rule
      expect(screen.getByText(/can only contain/i)).toBeInTheDocument();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('shows error for Windows reserved names', () => {
      render(<RenameFileModal {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'CON' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      expect(screen.getByText(/reserved by Windows/i)).toBeInTheDocument();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('shows error when basename ends with dot', () => {
      render(<RenameFileModal {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'profile.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      expect(screen.getByText(/cannot end with/i)).toBeInTheDocument();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('shows error when basename is same as current', () => {
      render(<RenameFileModal {...defaultProps} currentFilename="same-name.json" />);
      
      // Input already has 'same-name', clicking rename should show error
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      expect(screen.getByText('New filename is the same as current filename')).toBeInTheDocument();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });

    it('trims whitespace from basename', async () => {
      const onConfirm = vi.fn();
      render(<RenameFileModal {...defaultProps} onConfirm={onConfirm} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '  trimmed-name  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      // Wait for async collision check to complete
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('trimmed-name.json');
      });
    });
  });

  describe('Modal behavior', () => {
    it('shows current filename in info section', () => {
      render(<RenameFileModal {...defaultProps} currentFilename="current-file.json" />);
      
      expect(screen.getByText(/Current:/)).toBeInTheDocument();
      expect(screen.getByText('current-file.json')).toBeInTheDocument();
    });

    it('calls onOpenChange(false) when Cancel is clicked', () => {
      const onOpenChange = vi.fn();
      render(<RenameFileModal {...defaultProps} onOpenChange={onOpenChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('closes modal after successful rename', async () => {
      const onOpenChange = vi.fn();
      const onConfirm = vi.fn();
      render(<RenameFileModal {...defaultProps} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new-name' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
      
      // Wait for async collision check to complete
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});
