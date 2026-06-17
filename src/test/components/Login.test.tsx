import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from '../../../components/auth-onboarding/Login';

// Mock react-intl to return the message id as the text for testing
vi.mock('react-intl', () => ({
  FormattedMessage: ({ id, defaultMessage, children, values }: any) => {
    // For testing, return the id as the text content
    return <span>{id}</span>;
  },
  useIntl: () => ({
    formatMessage: ({ id }: any) => id,
  }),
}));

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

describe.skip('Login Component', () => {
  const mockOnLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default', () => {
    render(<Login onLogin={mockOnLogin} />);

    expect(screen.getByText('app.name')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.signIn' })).toBeInTheDocument();
  });

  it('switches to signup form when signup link is clicked', () => {
    render(<Login onLogin={mockOnLogin} />);

    const signupLink = screen.getByRole('button', { name: 'auth.dontHaveAccount' });
    fireEvent.click(signupLink);

    expect(screen.getByLabelText('auth.yourName')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.confirmPassword')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.signUp' })).toBeInTheDocument();
  });

  it('validates password strength', async () => {
    render(<Login onLogin={mockOnLogin} />);

    const emailInput = screen.getByLabelText('auth.email');
    const passwordInput = screen.getByLabelText('auth.password');
    const submitButton = screen.getByRole('button', { name: 'auth.signIn' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('auth.error.weakPassword')).toBeInTheDocument();
    });
  });

  it('validates password confirmation in signup mode', async () => {
    render(<Login onLogin={mockOnLogin} />);

    // Switch to signup
    const signupLink = screen.getByRole('button', { name: 'auth.dontHaveAccount' });
    fireEvent.click(signupLink);

    const emailInput = screen.getByLabelText('auth.email');
    const passwordInput = screen.getByLabelText('auth.password');
    const confirmPasswordInput = screen.getByLabelText('auth.confirmPassword');
    const nameInput = screen.getByLabelText('auth.yourName');
    const submitButton = screen.getByRole('button', { name: 'auth.signUp' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } });
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('auth.error.passwordMismatch')).toBeInTheDocument();
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

    const emailInput = screen.getByLabelText('auth.email');
    const passwordInput = screen.getByLabelText('auth.password');
    const submitButton = screen.getByRole('button', { name: 'auth.signIn' });

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