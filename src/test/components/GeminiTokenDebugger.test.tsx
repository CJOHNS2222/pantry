import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { GeminiTokenDebugger } from '../../../components/ui/GeminiTokenDebugger';
import React from 'react';

describe('GeminiTokenDebugger Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when isAdmin is false', () => {
    const { container } = render(<GeminiTokenDebugger isAdmin={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when isAdmin is true but no event has fired', () => {
    const { container } = render(<GeminiTokenDebugger isAdmin={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders token usage details when gemini-token-debug event is dispatched and isAdmin is true', () => {
    render(<GeminiTokenDebugger isAdmin={true} />);

    // Dispatch the custom event inside act
    act(() => {
      const event = new CustomEvent('gemini-token-debug', {
        detail: {
          inputTokens: 120,
          outputTokens: 350,
          totalTokens: 470,
          type: 'recipe-search',
          model: 'gemini-2.0-flash',
        },
      });
      window.dispatchEvent(event);
    });

    // Verify it is visible and has the correct info
    expect(screen.getByText('Gemini Token Debugger')).toBeInTheDocument();
    expect(screen.getByText('Recipe Search')).toBeInTheDocument();
    expect(screen.getByText('gemini-2.0-flash')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
    expect(screen.getByText('470')).toBeInTheDocument();
  });

  it('closes the debugger when the close button is clicked', () => {
    const { container } = render(<GeminiTokenDebugger isAdmin={true} />);

    // Dispatch the custom event inside act
    act(() => {
      const event = new CustomEvent('gemini-token-debug', {
        detail: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
          type: 'pantry-scan',
          model: 'gemini-model-vision',
        },
      });
      window.dispatchEvent(event);
    });

    expect(screen.getByText('Gemini Token Debugger')).toBeInTheDocument();

    // Click close button inside act
    const closeButton = screen.getByRole('button');
    act(() => {
      fireEvent.click(closeButton);
    });

    // Should hide
    expect(container.querySelector('.animate-slide-in-up')).toBeNull();
  });
});
