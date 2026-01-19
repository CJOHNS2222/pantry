import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from '../../../components/Login';
import { User } from '../../../types';

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

// Mock Firebase Analytics
vi.mock('firebase/analytics', () => ({
}));

// Mock firebaseConfig
vi.mock('../../../firebaseConfig', () => ({
  analytics: {},
}));

        expect(screen.getByText(/Password must be at least 6 characters/)).toBeInTheDocument();
  const mockOnLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default', () => {
    render(<Login onLogin={mockOnLogin} />);

    expect(screen.getAllByText('Smart Pantry Chef')[0]).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('chef@example.com')[0]).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('••••••••')[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /sign in/i })[0]).toBeInTheDocument();
  });

  it('switches to signup form when signup link is clicked', () => {
    render(<Login onLogin={mockOnLogin} />);

    const signupLink = screen.getAllByText("Don't have an account? Sign Up")[0];
    fireEvent.click(signupLink);

    expect(screen.getAllByPlaceholderText('Your Name')[0]).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Re-enter password')[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /sign up/i })[0]).toBeInTheDocument();
  });
        expect(mockSignIn).toHaveBeenCalled();

    // Test that inputs can receive values
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput).toHaveValue('invalid-email');
    expect(passwordInput).toHaveValue('password123');
  ;

  it('validates password strength', async () => {
    render(<Login onLogin={mockOnLogin} />);

    const emailInput = screen.getAllByPlaceholderText('chef@example.com')[0];
    const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
    const submitButton = screen.getAllByRole('button', { name: /sign in/i })[0];

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

  const mockOnLogin = vi.fn();

    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByText('Password must be at least 6 characters and contain a number and a letter.')[0]).toBeInTheDocument();
    });
  });

  it('validates password confirmation in signup mode', async () => {
    render(<Login onLogin={mockOnLogin} />);

    // Switch to signup
    const signupLink = screen.getAllByText("Don't have an account? Sign Up")[0];
    fireEvent.click(signupLink);

    const emailInput = screen.getAllByPlaceholderText('chef@example.com')[0];
    const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
    const confirmPasswordInput = screen.getAllByPlaceholderText('Re-enter password')[0];
    const nameInput = screen.getAllByPlaceholderText('Your Name')[0];
    const submitButton = screen.getAllByRole('button', { name: /sign up/i })[0];

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } });
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });
  });

  it('shows success message after successful signup', async () => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const mockSignIn = vi.mocked(signInWithEmailAndPassword);
    mockSignIn.mockResolvedValue({
      user: {
        uid: '123',
        email: 'test@example.com',
        displayName: 'Test User',
      },
    } as any);

    render(<Login onLogin={mockOnLogin} />);

    const emailInput = screen.getAllByPlaceholderText('chef@example.com')[0];
    const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
    const submitButton = screen.getAllByRole('button', { name: /sign in/i })[0];

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith({
        id: '123',
        name: 'Test User',
        email: 'test@example.com',
        provider: 'email',
        hasSeenTutorial: false,
      });
    });
  });
});