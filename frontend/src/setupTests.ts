import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch for relative API calls in jsdom
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
) as any;
