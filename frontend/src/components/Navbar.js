import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { isAuthenticated, clearAuth, getUser } from '../utils/auth';
import { Moon, Sun, User, LogOut, Activity } from 'lucide-react';
import { Button } from './ui/button';

const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <nav data-testid="main-navbar" className="sticky top-0 z-50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-sm transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" data-testid="logo-link" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-sky-600 dark:from-teal-400 dark:to-sky-400 bg-clip-text text-transparent">AyuMitraAI</span>
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated() ? (
              <>
                {user?.role === 'doctor' && (
                  <Link to="/doctor-dashboard" data-testid="dashboard-link">
                    <Button variant="ghost" size="sm">Dashboard</Button>
                  </Link>
                )}
                {user?.role === 'patient' && (
                  <Link to="/dashboard" data-testid="dashboard-link">
                    <Button variant="ghost" size="sm">Dashboard</Button>
                  </Link>
                )}
                {user?.role === 'clinic_admin' && (
                  <Link to="/clinic-registration" data-testid="dashboard-link">
                    <Button variant="ghost" size="sm">Clinic Management</Button>
                  </Link>
                )}
                {user?.role === 'hospital_admin' && (
                  <Link to="/hospital-registration" data-testid="dashboard-link">
                    <Button variant="ghost" size="sm">Hospital Management</Button>
                  </Link>
                )}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-full transition-colors duration-500">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">{user?.full_name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">({user?.role})</span>
                </div>
                <Button data-testid="logout-button" onClick={handleLogout} variant="ghost" size="sm">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" data-testid="login-link">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/signup" data-testid="signup-link">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
            
            <button
              data-testid="theme-toggle-button"
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-500"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;