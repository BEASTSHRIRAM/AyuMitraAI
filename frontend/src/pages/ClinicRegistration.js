import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import api from '../utils/api';
import { toast } from 'sonner';
import { Building2, MapPin, Loader2 } from 'lucide-react';

const ClinicRegistration = () => {
  const [formData, setFormData] = useState({
    clinic_name: '',
    location: { address: '', lat: '', lon: '' },
    doctor: { name: '', specialization: '', experience: '', availability_hours: '' },
    has_nurses: false,
    has_medicine_shop: false,
    fees: '',
    accepts_emergencies: false,
    contact_phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [registeredClinic, setRegisteredClinic] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const navigate = useNavigate();

  const handleGetLocation = () => {
    setGettingLocation(true);
    
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData({
          ...formData,
          location: {
            ...formData.location,
            lat: latitude.toString(),
            lon: longitude.toString()
          }
        });
        toast.success(`Location fetched: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please enable location access.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error('Location information is unavailable.');
        } else if (error.code === error.TIMEOUT) {
          toast.error('Location request timed out.');
        } else {
          toast.error('Unable to get your location. Please enter manually.');
        }
        setGettingLocation(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        location: {
          address: formData.location.address,
          lat: parseFloat(formData.location.lat) || 0,
          lon: parseFloat(formData.location.lon) || 0
        },
        doctor: {
          ...formData.doctor,
          experience: parseInt(formData.doctor.experience) || 0
        },
        fees: formData.fees ? parseFloat(formData.fees) : null
      };

      const response = await api.post('/clinics/register', payload);
      setRegisteredClinic(response.data);
      toast.success('Clinic registered successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="clinic-registration-page" className="min-h-screen py-12 px-6 transition-colors duration-500">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-slate-100 transition-colors duration-500" style={{ fontFamily: 'Manrope, sans-serif' }}>Register Your Clinic</h1>
          <p className="text-slate-600 dark:text-slate-400 transition-colors duration-500">Join the AyuMitraAI network and receive AI-matched patient referrals</p>
        </div>

        {registeredClinic ? (
          <Card className="transition-colors duration-500">
            <CardHeader>
              <CardTitle className="text-green-600 dark:text-green-400">✓ Clinic Registered Successfully!</CardTitle>
              <CardDescription>Share this unique ID with doctors for registration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-teal-50 dark:bg-teal-950/30 border-2 border-teal-500 rounded-xl p-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Unique Clinic ID</p>
                <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 font-mono tracking-wider">
                  {registeredClinic.clinic_id}
                </p>
                <p className="text-xs text-slate-500 mt-3">Doctors need this ID to register with your clinic</p>
              </div>
              <div className="space-y-2">
                <p><strong>Clinic Name:</strong> {registeredClinic.clinic_name}</p>
                <p><strong>Location:</strong> {registeredClinic.location.address}</p>
                <p><strong>Doctor:</strong> {registeredClinic.doctor.name} ({registeredClinic.doctor.specialization})</p>
              </div>
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="transition-colors duration-500">
            <CardHeader>
              <CardTitle>Clinic Information</CardTitle>
              <CardDescription>Provide details about your clinic and services</CardDescription>
            </CardHeader>
            <CardContent>
            <form data-testid="clinic-registration-form" onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="clinic_name">Clinic Name *</Label>
                <Input
                  data-testid="clinic-name-input"
                  id="clinic_name"
                  value={formData.clinic_name}
                  onChange={(e) => setFormData({...formData, clinic_name: e.target.value})}
                  placeholder="HealthCare Clinic"
                  required
                  className="h-12 rounded-lg transition-all duration-500"
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Location</h3>
                <Input
                  data-testid="clinic-address-input"
                  placeholder="Address *"
                  value={formData.location.address}
                  onChange={(e) => setFormData({...formData, location: {...formData.location, address: e.target.value}})}
                  required
                  className="h-12 rounded-lg transition-all duration-500"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      data-testid="clinic-lat-input"
                      type="number"
                      step="any"
                      placeholder="Latitude"
                      value={formData.location.lat}
                      onChange={(e) => setFormData({...formData, location: {...formData.location, lat: e.target.value}})}
                      className="h-12 rounded-lg transition-all duration-500"
                    />
                  </div>
                  <div>
                    <Input
                      data-testid="clinic-lon-input"
                      type="number"
                      step="any"
                      placeholder="Longitude"
                      value={formData.location.lon}
                      onChange={(e) => setFormData({...formData, location: {...formData.location, lon: e.target.value}})}
                      className="h-12 rounded-lg transition-all duration-500"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  variant="outline"
                  className="w-full h-12 rounded-lg transition-all duration-500"
                >
                  {gettingLocation ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Getting Location...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2" />
                      Get My Location
                    </>
                  )}
                </Button>
                {formData.location.lat && formData.location.lon && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 text-center">
                    ✓ Location: {parseFloat(formData.location.lat).toFixed(4)}, {parseFloat(formData.location.lon).toFixed(4)}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Doctor Information</h3>
                <Input
                  data-testid="doctor-name-input"
                  placeholder="Doctor Name *"
                  value={formData.doctor.name}
                  onChange={(e) => setFormData({...formData, doctor: {...formData.doctor, name: e.target.value}})}
                  required
                  className="h-12 rounded-lg transition-all duration-500"
                />
                <Input
                  data-testid="doctor-specialization-input"
                  placeholder="Specialization (e.g., Cardiology, General Medicine) *"
                  value={formData.doctor.specialization}
                  onChange={(e) => setFormData({...formData, doctor: {...formData.doctor, specialization: e.target.value}})}
                  required
                  className="h-12 rounded-lg transition-all duration-500"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    data-testid="doctor-experience-input"
                    type="number"
                    placeholder="Experience (years) *"
                    value={formData.doctor.experience}
                    onChange={(e) => setFormData({...formData, doctor: {...formData.doctor, experience: e.target.value}})}
                    required
                    min="0"
                    className="h-12 rounded-lg transition-all duration-500"
                  />
                  <Input
                    data-testid="doctor-availability-input"
                    placeholder="Availability (e.g., 9 AM - 6 PM) *"
                    value={formData.doctor.availability_hours}
                    onChange={(e) => setFormData({...formData, doctor: {...formData.doctor, availability_hours: e.target.value}})}
                    required
                    className="h-12 rounded-lg transition-all duration-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Facilities & Services</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    data-testid="has-nurses-checkbox"
                    id="has_nurses"
                    checked={formData.has_nurses}
                    onCheckedChange={(checked) => setFormData({...formData, has_nurses: checked})}
                  />
                  <Label htmlFor="has_nurses" className="cursor-pointer">Has Nurses</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    data-testid="has-medicine-shop-checkbox"
                    id="has_medicine_shop"
                    checked={formData.has_medicine_shop}
                    onCheckedChange={(checked) => setFormData({...formData, has_medicine_shop: checked})}
                  />
                  <Label htmlFor="has_medicine_shop" className="cursor-pointer">Has Medicine Shop</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    data-testid="accepts-emergencies-checkbox"
                    id="accepts_emergencies"
                    checked={formData.accepts_emergencies}
                    onCheckedChange={(checked) => setFormData({...formData, accepts_emergencies: checked})}
                  />
                  <Label htmlFor="accepts_emergencies" className="cursor-pointer">Accepts Emergencies</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fees">Consultation Fees (Optional)</Label>
                  <Input
                    data-testid="fees-input"
                    id="fees"
                    type="number"
                    step="0.01"
                    placeholder="500"
                    value={formData.fees}
                    onChange={(e) => setFormData({...formData, fees: e.target.value})}
                    className="h-12 rounded-lg transition-all duration-500"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone">Contact Phone *</Label>
                  <Input
                    data-testid="contact-phone-input"
                    id="contact_phone"
                    placeholder="+1234567890"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                    required
                    className="h-12 rounded-lg transition-all duration-500"
                  />
                </div>
              </div>

              <Button
                data-testid="submit-clinic-button"
                type="submit"
                disabled={loading}
                className="w-full rounded-full py-6 text-lg font-semibold"
              >
                {loading ? 'Registering...' : 'Register Clinic'}
              </Button>
            </form>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
};

export default ClinicRegistration;