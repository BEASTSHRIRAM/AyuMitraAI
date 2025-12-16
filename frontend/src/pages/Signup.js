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
import { UserPlus } from 'lucide-react';

const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'patient',
    facility_id: '',
    specialization: '',
    experience_years: '',
    license_number: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let response;
      if (formData.role === 'doctor') {
        const doctorData = {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: 'doctor',
          facility_id: formData.facility_id,
          specialization: formData.specialization,
          experience_years: parseInt(formData.experience_years),
          license_number: formData.license_number,
          phone: formData.phone
        };
        response = await api.post('/auth/register-doctor', doctorData);
      } else {
        const userData = {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role
        };
        response = await api.post('/auth/register', userData);
      }
      
      setToken(response.data.access_token);
      setUser(response.data.user);
      toast.success('Account created successfully!');
      
      if (formData.role === 'doctor') {
        navigate('/doctor-dashboard');
      } else if (formData.role === 'clinic_admin') {
        navigate('/clinic-registration');
      } else if (formData.role === 'hospital_admin') {
        navigate('/hospital-registration');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="signup-page" className="min-h-screen flex items-center justify-center px-6 py-12 transition-colors duration-500">
      <Card className="w-full max-w-md transition-colors duration-500">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>Create Account</CardTitle>
          <CardDescription className="text-center">Join AyuMitraAI for intelligent health routing</CardDescription>
        </CardHeader>
        <CardContent>
          <form data-testid="signup-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                data-testid="signup-name-input"
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="John Doe"
                required
                className="h-12 rounded-lg transition-all duration-500"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                data-testid="signup-email-input"
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="you@example.com"
                required
                className="h-12 rounded-lg transition-all duration-500"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                data-testid="signup-password-input"
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                className="h-12 rounded-lg transition-all duration-500"
              />
            </div>
            <div>
              <Label htmlFor="role">Account Type</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                <SelectTrigger data-testid="signup-role-select" className="h-12 rounded-lg transition-all duration-500">
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

            {formData.role === 'doctor' && (
              <>
                <div>
                  <Label htmlFor="facility_id">Clinic/Hospital ID</Label>
                  <Input
                    id="facility_id"
                    value={formData.facility_id}
                    onChange={(e) => setFormData({...formData, facility_id: e.target.value})}
                    placeholder="Enter unique facility ID from your clinic/hospital"
                    required
                    className="h-12 rounded-lg transition-all duration-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Contact your clinic/hospital administrator for this ID</p>
                </div>
                <div>
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization}
                    onChange={(e) => setFormData({...formData, specialization: e.target.value})}
                    placeholder="e.g., Cardiology, General Medicine"
                    required
                    className="h-12 rounded-lg transition-all duration-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="experience_years">Experience (Years)</Label>
                    <Input
                      id="experience_years"
                      type="number"
                      value={formData.experience_years}
                      onChange={(e) => setFormData({...formData, experience_years: e.target.value})}
                      placeholder="5"
                      required
                      min="0"
                      className="h-12 rounded-lg transition-all duration-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="license_number">License Number</Label>
                    <Input
                      id="license_number"
                      value={formData.license_number}
                      onChange={(e) => setFormData({...formData, license_number: e.target.value})}
                      placeholder="MED12345"
                      required
                      className="h-12 rounded-lg transition-all duration-500"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1234567890"
                    required
                    className="h-12 rounded-lg transition-all duration-500"
                  />
                </div>
              </>
            )}

            <Button data-testid="signup-submit-button" type="submit" disabled={loading} className="w-full rounded-full py-6">
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center mt-6 text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-600 dark:text-teal-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;