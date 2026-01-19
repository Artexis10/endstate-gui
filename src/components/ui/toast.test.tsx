import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showToast } from './toast';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

describe('Toast System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Duration behaviour', () => {
    it('uses 3000ms duration for info toast', () => {
      const mockId = 'toast-123';
      vi.mocked(toast.info).mockReturnValue(mockId);

      showToast('Info message', 'info');

      expect(toast.info).toHaveBeenCalledWith(
        'Info message',
        expect.objectContaining({ duration: 3000 })
      );
    });

    it('uses 3000ms duration for success toast', () => {
      const mockId = 'toast-456';
      vi.mocked(toast.success).mockReturnValue(mockId);

      showToast('Success message', 'success');

      expect(toast.success).toHaveBeenCalledWith(
        'Success message',
        expect.objectContaining({ duration: 3000 })
      );
    });

    it('uses 5000ms duration for warning toast', () => {
      const mockId = 'toast-789';
      vi.mocked(toast.warning).mockReturnValue(mockId);

      showToast('Warning message', 'warning');

      expect(toast.warning).toHaveBeenCalledWith(
        'Warning message',
        expect.objectContaining({ duration: 5000 })
      );
    });

    it('uses 5000ms duration for error toast', () => {
      const mockId = 'toast-abc';
      vi.mocked(toast.error).mockReturnValue(mockId);

      showToast('Error message', 'error');

      expect(toast.error).toHaveBeenCalledWith(
        'Error message',
        expect.objectContaining({ duration: 5000 })
      );
    });

    it('defaults to info type with 3000ms when type not specified', () => {
      const mockId = 'toast-default';
      vi.mocked(toast.info).mockReturnValue(mockId);

      showToast('Default message');

      expect(toast.info).toHaveBeenCalledWith(
        'Default message',
        expect.objectContaining({ duration: 3000 })
      );
    });
  });

  describe('Dismissible behaviour', () => {
    it('sets dismissible option for success toast', () => {
      const mockId = 'success-toast-123';
      vi.mocked(toast.success).mockReturnValue(mockId);

      showToast('Success', 'success');

      expect(toast.success).toHaveBeenCalledWith(
        'Success',
        expect.objectContaining({ dismissible: true })
      );
    });

    it('sets dismissible option for error toast', () => {
      const mockId = 'error-toast-456';
      vi.mocked(toast.error).mockReturnValue(mockId);

      showToast('Error', 'error');

      expect(toast.error).toHaveBeenCalledWith(
        'Error',
        expect.objectContaining({ dismissible: true })
      );
    });

    it('sets dismissible option for warning toast', () => {
      const mockId = 'warning-toast-789';
      vi.mocked(toast.warning).mockReturnValue(mockId);

      showToast('Warning', 'warning');

      expect(toast.warning).toHaveBeenCalledWith(
        'Warning',
        expect.objectContaining({ dismissible: true })
      );
    });

    it('sets dismissible option for info toast', () => {
      const mockId = 'info-toast-abc';
      vi.mocked(toast.info).mockReturnValue(mockId);

      showToast('Info', 'info');

      expect(toast.info).toHaveBeenCalledWith(
        'Info',
        expect.objectContaining({ dismissible: true })
      );
    });

    it('returns the toast id from showToast', () => {
      const mockId = 'returned-toast-id';
      vi.mocked(toast.success).mockReturnValue(mockId);

      const result = showToast('Test', 'success');

      expect(result).toBe(mockId);
    });

    it('each toast has its own dismissible option', () => {
      const mockId1 = 'toast-1';
      const mockId2 = 'toast-2';
      
      vi.mocked(toast.success).mockReturnValueOnce(mockId1);
      vi.mocked(toast.error).mockReturnValueOnce(mockId2);

      showToast('First', 'success');
      showToast('Second', 'error');

      expect(toast.success).toHaveBeenCalledWith(
        'First',
        expect.objectContaining({ dismissible: true })
      );
      expect(toast.error).toHaveBeenCalledWith(
        'Second',
        expect.objectContaining({ dismissible: true })
      );
    });
  });
});
