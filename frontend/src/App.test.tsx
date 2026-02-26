import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App component', () => {
  it('renders without crashing', () => {
    // This is a minimal test to ensure the environment is set up.
    // Replace this with actual tests for the App component.
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });
});
