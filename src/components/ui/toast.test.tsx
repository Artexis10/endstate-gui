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

  describe('Click-to-dismiss behaviour', () => {
    it('dismisses the correct toast id when onClick is called for success toast', () => {
      const mockId = 'success-toast-123';
      vi.mocked(toast.success).mockReturnValue(mockId);

      showToast('Success', 'success');

      const callArgs = vi.mocked(toast.success).mock.calls[0];
      const options = callArgs[1] as any;
      
      expect(options.onClick).toBeDefined();
      
      // Simulate clicking the toast
      options.onClick();
      
      expect(toast.dismiss).toHaveBeenCalledWith(mockId);
    });

    it('dismisses the correct toast id when onClick is called for error toast', () => {
      const mockId = 'error-toast-456';
      vi.mocked(toast.error).mockReturnValue(mockId);

      showToast('Error', 'error');

      const callArgs = vi.mocked(toast.error).mock.calls[0];
      const options = callArgs[1] as any;
      
      options.onClick();
      
      expect(toast.dismiss).toHaveBeenCalledWith(mockId);
    });

    it('dismisses the correct toast id when onClick is called for warning toast', () => {
      const mockId = 'warning-toast-789';
      vi.mocked(toast.warning).mockReturnValue(mockId);

      showToast('Warning', 'warning');

      const callArgs = vi.mocked(toast.warning).mock.calls[0];
      const options = callArgs[1] as any;
      
      options.onClick();
      
      expect(toast.dismiss).toHaveBeenCalledWith(mockId);
    });

    it('dismisses the correct toast id when onClick is called for info toast', () => {
      const mockId = 'info-toast-abc';
      vi.mocked(toast.info).mockReturnValue(mockId);

      showToast('Info', 'info');

      const callArgs = vi.mocked(toast.info).mock.calls[0];
      const options = callArgs[1] as any;
      
      options.onClick();
      
      expect(toast.dismiss).toHaveBeenCalledWith(mockId);
    });

    it('returns the toast id from showToast', () => {
      const mockId = 'returned-toast-id';
      vi.mocked(toast.success).mockReturnValue(mockId);

      const result = showToast('Test', 'success');

      expect(result).toBe(mockId);
    });

    it('dismisses only the specific toast, not all toasts', () => {
      const mockId1 = 'toast-1';
      const mockId2 = 'toast-2';
      
      vi.mocked(toast.success).mockReturnValueOnce(mockId1);
      vi.mocked(toast.error).mockReturnValueOnce(mockId2);

      showToast('First', 'success');
      showToast('Second', 'error');

      // Click the first toast
      const firstCallArgs = vi.mocked(toast.success).mock.calls[0];
      const firstOptions = firstCallArgs[1] as any;
      firstOptions.onClick();
      
      expect(toast.dismiss).toHaveBeenCalledWith(mockId1);
      expect(toast.dismiss).not.toHaveBeenCalledWith(mockId2);
    });
  });
});
