import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../utils/api';
import { setToken, setUser } from '../utils/auth';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('patient');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      setToken(response.data.access_token);
      setUser(response.data.user);
      toast.success('Login successful!');
      
      // Redirect based on role
      if (response.data.user.role === 'doctor') {
        navigate('/doctor-dashboard');
      } else if (response.data.user.role === 'clinic_admin') {
        navigate('/clinic-registration');
      } else if (response.data.user.role === 'hospital_admin') {
        navigate('/hospital-registration');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="login-page" className="min-h-screen flex items-center justify-center px-6 py-12 transition-colors duration-500">
      <Card className="w-full max-w-md transition-colors duration-500">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>Welcome Back</CardTitle>
          <CardDescription className="text-center">Sign in to access your medical dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="role">Account Type</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger data-testid="login-role-select" className="h-12 rounded-lg transition-all duration-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="clinic_admin">Clinic Administrator</SelectItem>
                  <SelectItem value="hospital_admin">Hospital Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                data-testid="login-email-input"
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-12 rounded-lg transition-all duration-500"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                data-testid="login-password-input"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="h-12 rounded-lg transition-all duration-500"
              />
            </div>
            <Button data-testid="login-submit-button" type="submit" disabled={loading} className="w-full rounded-full py-6">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <p className="text-center mt-6 text-sm text-slate-600 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-teal-600 dark:text-teal-400 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;