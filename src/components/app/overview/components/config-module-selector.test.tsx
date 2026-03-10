import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../../test/test-utils';
import { ConfigModuleSelector } from './config-module-selector';
import type { ConfigModuleInfo } from '@/types';

describe('ConfigModuleSelector', () => {
  const mockModules: ConfigModuleInfo[] = [
    { id: 'vscode', displayName: 'VS Code', entries: 3, files: ['settings.json', 'keybindings.json', 'snippets/'] },
    { id: 'git', displayName: 'Git', entries: 1, files: ['.gitconfig'] },
    { id: 'terminal', displayName: 'Windows Terminal', entries: 2, files: ['settings.json', 'state.json'] },
  ];

  const defaultProps = {
    modules: mockModules,
    selectedModules: ['vscode', 'git', 'terminal'],
    onSelectionChange: vi.fn(),
  };

  it('renders when modules are present', () => {
    renderWithProviders(<ConfigModuleSelector {...defaultProps} />);

    expect(screen.getByTestId('config-module-selector')).toBeInTheDocument();
    expect(screen.getByText('Settings to restore:')).toBeInTheDocument();
  });

  it('returns null when modules array is empty', () => {
    const { container } = renderWithProviders(
      <ConfigModuleSelector {...defaultProps} modules={[]} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders a checkbox for each module', () => {
    renderWithProviders(<ConfigModuleSelector {...defaultProps} />);

    expect(screen.getByText('VS Code')).toBeInTheDocument();
    expect(screen.getByText('Git')).toBeInTheDocument();
    expect(screen.getByText('Windows Terminal')).toBeInTheDocument();
  });

  it('shows file count per module when entries > 0', () => {
    renderWithProviders(<ConfigModuleSelector {...defaultProps} />);

    expect(screen.getByText('3 files')).toBeInTheDocument();
    expect(screen.getByText('1 file')).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();
  });

  it('hides file count when entries is 0', () => {
    const zeroModules: ConfigModuleInfo[] = [
      { id: 'vscode', displayName: 'VS Code', entries: 0, files: [] },
    ];
    renderWithProviders(
      <ConfigModuleSelector {...defaultProps} modules={zeroModules} />
    );

    expect(screen.getByText('VS Code')).toBeInTheDocument();
    expect(screen.queryByText('0 files')).not.toBeInTheDocument();
  });

  it('renders select all button and selects all modules', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ConfigModuleSelector {...defaultProps} selectedModules={[]} onSelectionChange={onChange} />
    );

    const toggleAll = screen.getByTestId('config-module-toggle-all');
    expect(toggleAll).toHaveTextContent('Select all');
    toggleAll.click();

    expect(onChange).toHaveBeenCalledWith(['vscode', 'git', 'terminal']);
  });

  it('renders deselect all button when all selected and deselects all', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ConfigModuleSelector {...defaultProps} onSelectionChange={onChange} />
    );

    const toggleAll = screen.getByTestId('config-module-toggle-all');
    expect(toggleAll).toHaveTextContent('Deselect all');
    toggleAll.click();

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('calls onSelectionChange to remove a module when unchecked', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ConfigModuleSelector {...defaultProps} onSelectionChange={onChange} />
    );

    // Click the Git checkbox to deselect it
    const gitCheckbox = screen.getByRole('checkbox', { name: /git/i });
    gitCheckbox.click();

    expect(onChange).toHaveBeenCalledWith(['vscode', 'terminal']);
  });

  it('calls onSelectionChange to add a module when checked', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ConfigModuleSelector
        {...defaultProps}
        selectedModules={['vscode']}
        onSelectionChange={onChange}
      />
    );

    // Click the Git checkbox to select it
    const gitCheckbox = screen.getByRole('checkbox', { name: /git/i });
    gitCheckbox.click();

    expect(onChange).toHaveBeenCalledWith(['vscode', 'git']);
  });
});
