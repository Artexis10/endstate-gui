export function seedLocalStorage(data: Record<string, any>): void {
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
}

export function getLocalStorageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

export function getLocalStorageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        snapshot[key] = value;
      }
    }
  }
  return snapshot;
}

export function assertLocalStorageKey(key: string, expectedValue?: any): void {
  const value = localStorage.getItem(key);
  
  if (expectedValue === undefined) {
    if (value === null) {
      throw new Error(`Expected localStorage key "${key}" to exist, but it was not found`);
    }
    return;
  }
  
  if (value === null) {
    throw new Error(`Expected localStorage key "${key}" to have value ${JSON.stringify(expectedValue)}, but key was not found`);
  }
  
  const expectedStr = typeof expectedValue === 'string' ? expectedValue : JSON.stringify(expectedValue);
  
  if (value !== expectedStr) {
    throw new Error(`Expected localStorage key "${key}" to have value ${expectedStr}, but got ${value}`);
  }
}

export function clearLocalStorage(): void {
  localStorage.clear();
}
