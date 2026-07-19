import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../test/test-utils';
import { DropZone } from './drop-zone';

function createFile(name: string): File {
  return new File(['content'], name, { type: 'application/octet-stream' });
}

describe('DropZone', () => {
  const defaultProps = {
    onFileDrop: vi.fn(),
  };

  it('renders the drop zone region', () => {
    renderWithProviders(<DropZone {...defaultProps} />);
    expect(screen.getByRole('region', { name: /drop zone/i })).toBeInTheDocument();
  });

  it('shows idle text when not dragging', () => {
    renderWithProviders(<DropZone {...defaultProps} />);
    expect(screen.getByText(/click to browse or drop a file/i)).toBeInTheDocument();
    expect(screen.getByText(/accepts .zip bundles or .jsonc manifest files/i)).toBeInTheDocument();
  });

  it('shows drag-over text during drag', () => {
    renderWithProviders(<DropZone {...defaultProps} />);
    const zone = screen.getByTestId('drop-zone');
    fireEvent.dragOver(zone, {
      dataTransfer: { files: [createFile('profile.zip')] },
    });
    expect(screen.getByText(/drop to import/i)).toBeInTheDocument();
  });

  it('shows controlled native acceptance without a browser drag event', () => {
    const props = {
      ...defaultProps,
      nativeDragAccepted: true,
    } as ComponentProps<typeof DropZone> & { nativeDragAccepted: boolean };
    const { rerender } = renderWithProviders(<DropZone {...props} />);

    const zone = screen.getByTestId('drop-zone');
    expect(screen.getByText(/drop to import/i)).toBeInTheDocument();
    expect(zone.className).toContain('border-green-500');

    const clearedProps = { ...props, nativeDragAccepted: false };
    rerender(<DropZone {...clearedProps} />);
    expect(screen.getByText(/click to browse or drop a file/i)).toBeInTheDocument();
    expect(zone.className).not.toContain('border-green-500 bg-green-500/5');
  });

  it('accepts supported browser drag enter and clears acceptance on leave', () => {
    renderWithProviders(<DropZone {...defaultProps} />);
    const zone = screen.getByTestId('drop-zone');
    const dataTransfer = { files: [createFile('profile.json5')] };

    fireEvent.dragEnter(zone, { dataTransfer });
    expect(screen.getByText(/drop to import/i)).toBeInTheDocument();

    fireEvent.dragLeave(zone, { dataTransfer });
    expect(screen.getByText(/click to browse or drop a file/i)).toBeInTheDocument();
  });

  it('never shows acceptance for an unsupported browser drag', () => {
    renderWithProviders(<DropZone {...defaultProps} />);
    const zone = screen.getByTestId('drop-zone');
    const dataTransfer = { files: [createFile('notes.txt')] };

    fireEvent.dragEnter(zone, { dataTransfer });
    fireEvent.dragOver(zone, { dataTransfer });

    expect(screen.getByText(/click to browse or drop a file/i)).toBeInTheDocument();
    expect(zone.className).not.toContain('border-green-500 bg-green-500/5');
  });

  it('applies drag-over styling during drag and has leave handler', () => {
    renderWithProviders(<DropZone {...defaultProps} />);
    const zone = screen.getByTestId('drop-zone');
    // Before drag, no green-500 border
    expect(zone.className).not.toContain('border-green-500 bg-green-500/5');
    fireEvent.dragOver(zone);
    // After dragOver, isDragOver is true => green styling
    expect(zone.className).toContain('border-green-500');
  });

  it('calls onFileDrop with accepted files on drop', () => {
    const onFileDrop = vi.fn();
    renderWithProviders(<DropZone onFileDrop={onFileDrop} />);
    const zone = screen.getByTestId('drop-zone');

    const zipFile = createFile('profile.zip');
    const jsoncFile = createFile('profile.jsonc');
    fireEvent.drop(zone, {
      dataTransfer: { files: [zipFile, jsoncFile] },
    });

    expect(onFileDrop).toHaveBeenCalledTimes(1);
    const droppedFiles = onFileDrop.mock.calls[0][0];
    expect(droppedFiles).toEqual([zipFile, jsoncFile]);
    expect(screen.getByText(/click to browse or drop a file/i)).toBeInTheDocument();
  });

  it('filters out non-accepted file types on drop', () => {
    const onFileDrop = vi.fn();
    renderWithProviders(<DropZone onFileDrop={onFileDrop} />);
    const zone = screen.getByTestId('drop-zone');

    const txtFile = createFile('readme.txt');
    const jsoncFile = createFile('profile.jsonc');
    fireEvent.drop(zone, {
      dataTransfer: { files: [txtFile, jsoncFile] },
    });

    expect(onFileDrop).toHaveBeenCalledTimes(1);
    const droppedFiles = onFileDrop.mock.calls[0][0];
    expect(droppedFiles).toHaveLength(1);
    expect(droppedFiles[0].name).toBe('profile.jsonc');
  });

  it('does not call onFileDrop when all files are rejected', () => {
    const onFileDrop = vi.fn();
    renderWithProviders(<DropZone onFileDrop={onFileDrop} />);
    const zone = screen.getByTestId('drop-zone');

    const txtFile = createFile('readme.txt');
    fireEvent.drop(zone, {
      dataTransfer: { files: [txtFile] },
    });

    expect(onFileDrop).not.toHaveBeenCalled();
  });

  it('accepts .json, .jsonc, .json5, and .zip extensions', () => {
    const onFileDrop = vi.fn();
    renderWithProviders(<DropZone onFileDrop={onFileDrop} />);
    const zone = screen.getByTestId('drop-zone');

    const files = [
      createFile('a.json'),
      createFile('b.jsonc'),
      createFile('c.json5'),
      createFile('d.zip'),
    ];
    fireEvent.drop(zone, { dataTransfer: { files } });

    expect(onFileDrop).toHaveBeenCalledTimes(1);
    expect(onFileDrop.mock.calls[0][0]).toHaveLength(4);
  });

  it('does not respond to drag when disabled', () => {
    renderWithProviders(<DropZone {...defaultProps} disabled />);
    const zone = screen.getByTestId('drop-zone');
    fireEvent.dragOver(zone);
    // Should not show drag-over text
    expect(screen.getByText(/click to browse or drop a file/i)).toBeInTheDocument();
  });

  it('does not call onFileDrop on drop when disabled', () => {
    const onFileDrop = vi.fn();
    renderWithProviders(<DropZone onFileDrop={onFileDrop} disabled />);
    const zone = screen.getByTestId('drop-zone');

    fireEvent.drop(zone, {
      dataTransfer: { files: [createFile('profile.zip')] },
    });

    expect(onFileDrop).not.toHaveBeenCalled();
  });

  it('calls onBrowse when clicked and onBrowse is provided', () => {
    const onBrowse = vi.fn();
    renderWithProviders(<DropZone {...defaultProps} onBrowse={onBrowse} />);
    const zone = screen.getByTestId('drop-zone');
    fireEvent.click(zone);
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it('does not call onBrowse when clicked and disabled', () => {
    const onBrowse = vi.fn();
    renderWithProviders(<DropZone {...defaultProps} onBrowse={onBrowse} disabled />);
    const zone = screen.getByTestId('drop-zone');
    fireEvent.click(zone);
    expect(onBrowse).not.toHaveBeenCalled();
  });

  it('applies disabled styling when disabled', () => {
    renderWithProviders(<DropZone {...defaultProps} disabled />);
    const zone = screen.getByTestId('drop-zone');
    expect(zone.className).toContain('opacity-50');
    expect(zone.className).toContain('cursor-not-allowed');
  });

  it('renders hidden file input with correct accept attribute', () => {
    renderWithProviders(<DropZone {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toBe('.zip,.json,.jsonc,.json5');
    expect(input.getAttribute('aria-hidden')).toBe('true');
  });
});
