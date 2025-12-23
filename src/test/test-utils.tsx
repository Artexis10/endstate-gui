import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

function AllProviders({ children, initialRoute }: { children: ReactNode; initialRoute?: string }) {
  if (initialRoute && typeof window !== 'undefined') {
    window.history.pushState({}, '', initialRoute);
  }
  
  return <>{children}</>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderWithProvidersOptions
) {
  const { initialRoute, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => <AllProviders initialRoute={initialRoute}>{children}</AllProviders>,
    ...renderOptions,
  });
}

export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
