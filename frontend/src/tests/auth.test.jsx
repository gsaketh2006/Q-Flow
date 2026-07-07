import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// ─── Loading State ─────────────────────────────────────────────────────────────

describe('ProtectedRoute — loading state', () => {
  it('renders a spinner while auth is loading', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Neither the protected content nor the login page should appear during loading
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
    expect(screen.queryByText('Login Page')).toBeNull();
  });
});

// ─── Unauthenticated Redirects ─────────────────────────────────────────────────

describe('ProtectedRoute — unauthenticated', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
  });

  it('redirects to /login when not authenticated (admin route)', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeDefined();
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
  });

  it('redirects to /login when not authenticated (staff route)', () => {
    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <div>Staff Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeDefined();
    expect(screen.queryByText('Staff Dashboard')).toBeNull();
  });

  it('redirects to /login when not authenticated (citizen route)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <div>Citizen Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeDefined();
  });
});

// ─── Authenticated with Correct Role ──────────────────────────────────────────

describe('ProtectedRoute — authenticated, correct role', () => {
  it('renders children for admin accessing /admin', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 1, email: 'admin@test.com', role_name: 'admin' },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Dashboard')).toBeDefined();
  });

  it('renders children for staff accessing /staff', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 2, email: 'staff@test.com', role_name: 'staff' },
    });

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <div>Staff Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Staff Dashboard')).toBeDefined();
  });

  it('renders children for citizen accessing /', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 3, email: 'citizen@test.com', role_name: 'citizen' },
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <div>Citizen Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Citizen Dashboard')).toBeDefined();
  });
});

// ─── Authenticated with Wrong Role (Cross-Role Redirect) ───────────────────────

describe('ProtectedRoute — authenticated, wrong role', () => {
  it('redirects citizen to / when accessing /admin', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 3, email: 'citizen@test.com', role_name: 'citizen' },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/" element={<div>Citizen Home</div>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Citizen Home')).toBeDefined();
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
  });

  it('redirects admin to /admin when accessing /staff', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 1, email: 'admin@test.com', role_name: 'admin' },
    });

    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route path="/admin" element={<div>Admin Home</div>} />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <div>Staff Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Home')).toBeDefined();
    expect(screen.queryByText('Staff Dashboard')).toBeNull();
  });

  it('redirects staff to /staff when accessing /admin', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 2, email: 'staff@test.com', role_name: 'staff' },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/staff" element={<div>Staff Home</div>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div>Admin Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Staff Home')).toBeDefined();
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
  });
});
