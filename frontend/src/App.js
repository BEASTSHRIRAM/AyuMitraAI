import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/sonner';
import { isAuthenticated, getUser } from './utils/auth';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import ResultsPage from './pages/ResultsPage';
import ClinicRegistration from './pages/ClinicRegistration';
import HospitalRegistration from './pages/HospitalRegistration';
import './App.css';

const PrivateRoute = ({ children, allowedRoles }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles) {
    const user = getUser();
    if (!allowedRoles.includes(user?.role)) {
      // Redirect to appropriate dashboard based on role
      if (user?.role === 'doctor') return <Navigate to="/doctor-dashboard" />;
      if (user?.role === 'clinic_admin') return <Navigate to="/clinic-registration" />;
      if (user?.role === 'hospital_admin') return <Navigate to="/hospital-registration" />;
      return <Navigate to="/dashboard" />;
    }
  }
  
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="App min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute allowedRoles={['patient']}>
                  <PatientDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/doctor-dashboard"
              element={
                <PrivateRoute allowedRoles={['doctor']}>
                  <DoctorDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/results"
              element={
                <PrivateRoute allowedRoles={['patient']}>
                  <ResultsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/clinic-registration"
              element={
                <PrivateRoute allowedRoles={['clinic_admin']}>
                  <ClinicRegistration />
                </PrivateRoute>
              }
            />
            <Route
              path="/hospital-registration"
              element={
                <PrivateRoute allowedRoles={['hospital_admin']}>
                  <HospitalRegistration />
                </PrivateRoute>
              }
            />
          </Routes>
          <Toaster richColors position="top-right" />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;