import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../utils/api';
import { toast } from 'sonner';
import { Building, Plus, Trash2, MapPin, Loader2 } from 'lucide-react';

const HospitalRegistration = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    hospital_name: '',
    hospital_type: 'private',
    location: { address: '', lat: '', lon: '' },
    doctors: [{ name: '', specialization: '', experience: '', shift_timings: '' }],
    total_rooms: '',
    icu_beds: '',
    has_emergency_dept: false,
    operation_theatres: '',
    nurses_count: '',
    services: [],
    contact_phone: ''
  });
  const [serviceInput, setServiceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredHospital, setRegisteredHospital] = useState(null);
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

  const addDoctor = () => {
    setFormData({
      ...formData,
      doctors: [...formData.doctors, { name: '', specialization: '', experience: '', shift_timings: '' }]
    });
  };

  const removeDoctor = (index) => {
    setFormData({
      ...formData,
      doctors: formData.doctors.filter((_, i) => i !== index)
    });
  };

  const updateDoctor = (index, field, value) => {
    const updatedDoctors = [...formData.doctors];
    updatedDoctors[index][field] = value;
    setFormData({ ...formData, doctors: updatedDoctors });
  };

  const addService = () => {
    if (serviceInput.trim()) {
      setFormData({ ...formData, services: [...formData.services, serviceInput.trim()] });
      setServiceInput('');
    }
  };

  const removeService = (index) => {
    setFormData({ ...formData, services: formData.services.filter((_, i) => i !== index) });
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
        doctors: formData.doctors.map(d => ({
          ...d,
          experience: parseInt(d.experience) || 0
        })),
        total_rooms: parseInt(formData.total_rooms) || 0,
        icu_beds: parseInt(formData.icu_beds) || 0,
        operation_theatres: parseInt(formData.operation_theatres) || 0,
        nurses_count: parseInt(formData.nurses_count) || 0
      };

      const response = await api.post('/hospitals/register', payload);
      setRegisteredHospital(response.data);
      toast.success('Hospital registered successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="hospital-registration-page" className="min-h-screen py-12 px-6 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 mb-4">
            <Building className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-slate-100 transition-colors duration-500" style={{ fontFamily: 'Manrope, sans-serif' }}>Register Your Hospital</h1>
          <p className="text-slate-600 dark:text-slate-400 transition-colors duration-500">Multi-step registration for comprehensive hospital information</p>
        </div>

        <div data-testid="stepper" className="flex justify-center mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-500 ${
                step >= s ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-20 h-1 transition-all duration-500 ${
                step > s ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
              }`} />}
            </div>
          ))}
        </div>

        {registeredHospital ? (
          <Card className="transition-colors duration-500">
            <CardHeader>
              <CardTitle className="text-green-600 dark:text-green-400">✓ Hospital Registered Successfully!</CardTitle>
              <CardDescription>Share this unique ID with doctors for registration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-teal-50 dark:bg-teal-950/30 border-2 border-teal-500 rounded-xl p-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Unique Hospital ID</p>
                <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 font-mono tracking-wider">
                  {registeredHospital.hospital_id}
                </p>
                <p className="text-xs text-slate-500 mt-3">Doctors need this ID to register with your hospital</p>
              </div>
              <div className="space-y-2">
                <p><strong>Hospital Name:</strong> {registeredHospital.hospital_name}</p>
                <p><strong>Type:</strong> {registeredHospital.hospital_type}</p>
                <p><strong>Location:</strong> {registeredHospital.location.address}</p>
                <p><strong>Doctors:</strong> {registeredHospital.doctors_count}</p>
                <p><strong>Emergency Dept:</strong> {registeredHospital.has_emergency_dept ? 'Yes' : 'No'}</p>
              </div>
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="transition-colors duration-500">
            <CardHeader>
              <CardTitle>
                {step === 1 && 'Basic Information'}
                {step === 2 && 'Doctors & Staff'}
                {step === 3 && 'Facilities & Services'}
              </CardTitle>
            </CardHeader>
            <CardContent>
            <form data-testid="hospital-registration-form" onSubmit={handleSubmit}>
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label>Hospital Name *</Label>
                    <Input
                      data-testid="hospital-name-input"
                      value={formData.hospital_name}
                      onChange={(e) => setFormData({...formData, hospital_name: e.target.value})}
                      required
                      className="h-12 rounded-lg transition-all duration-500"
                    />
                  </div>
                  <div>
                    <Label>Hospital Type *</Label>
                    <Select value={formData.hospital_type} onValueChange={(value) => setFormData({...formData, hospital_type: value})}>
                      <SelectTrigger data-testid="hospital-type-select" className="h-12 rounded-lg transition-all duration-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Address *</Label>
                    <Input
                      data-testid="hospital-address-input"
                      value={formData.location.address}
                      onChange={(e) => setFormData({...formData, location: {...formData.location, address: e.target.value}})}
                      required
                      className="h-12 rounded-lg transition-all duration-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Latitude</Label>
                      <Input
                        data-testid="hospital-lat-input"
                        type="number"
                        step="any"
                        value={formData.location.lat}
                        onChange={(e) => setFormData({...formData, location: {...formData.location, lat: e.target.value}})}
                        className="h-12 rounded-lg transition-all duration-500"
                      />
                    </div>
                    <div>
                      <Label>Longitude</Label>
                      <Input
                        data-testid="hospital-lon-input"
                        type="number"
                        step="any"
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
                  <div>
                    <Label>Contact Phone *</Label>
                    <Input
                      data-testid="hospital-phone-input"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                      required
                      className="h-12 rounded-lg transition-all duration-500"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Doctors ({formData.doctors.length})</h3>
                    <Button data-testid="add-doctor-button" type="button" onClick={addDoctor} size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Add Doctor
                    </Button>
                  </div>
                  {formData.doctors.map((doctor, idx) => (
                    <div key={idx} data-testid={`doctor-${idx}`} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3 transition-colors duration-500">
                      <div className="flex justify-between">
                        <h4 className="font-medium">Doctor {idx + 1}</h4>
                        {formData.doctors.length > 1 && (
                          <Button data-testid={`remove-doctor-${idx}`} type="button" onClick={() => removeDoctor(idx)} variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <Input
                        placeholder="Name *"
                        value={doctor.name}
                        onChange={(e) => updateDoctor(idx, 'name', e.target.value)}
                        required
                        className="transition-all duration-500"
                      />
                      <Input
                        placeholder="Specialization *"
                        value={doctor.specialization}
                        onChange={(e) => updateDoctor(idx, 'specialization', e.target.value)}
                        required
                        className="transition-all duration-500"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="number"
                          placeholder="Experience (years) *"
                          value={doctor.experience}
                          onChange={(e) => updateDoctor(idx, 'experience', e.target.value)}
                          required
                          min="0"
                          className="transition-all duration-500"
                        />
                        <Input
                          placeholder="Shift Timings *"
                          value={doctor.shift_timings}
                          onChange={(e) => updateDoctor(idx, 'shift_timings', e.target.value)}
                          required
                          className="transition-all duration-500"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Total Nurses *</Label>
                      <Input
                        data-testid="nurses-count-input"
                        type="number"
                        value={formData.nurses_count}
                        onChange={(e) => setFormData({...formData, nurses_count: e.target.value})}
                        required
                        min="0"
                        className="h-12 rounded-lg transition-all duration-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Total Rooms *</Label>
                      <Input
                        data-testid="total-rooms-input"
                        type="number"
                        value={formData.total_rooms}
                        onChange={(e) => setFormData({...formData, total_rooms: e.target.value})}
                        required
                        min="0"
                        className="h-12 rounded-lg transition-all duration-500"
                      />
                    </div>
                    <div>
                      <Label>ICU Beds *</Label>
                      <Input
                        data-testid="icu-beds-input"
                        type="number"
                        value={formData.icu_beds}
                        onChange={(e) => setFormData({...formData, icu_beds: e.target.value})}
                        required
                        min="0"
                        className="h-12 rounded-lg transition-all duration-500"
                      />
                    </div>
                    <div>
                      <Label>Operation Theatres *</Label>
                      <Input
                        data-testid="operation-theatres-input"
                        type="number"
                        value={formData.operation_theatres}
                        onChange={(e) => setFormData({...formData, operation_theatres: e.target.value})}
                        required
                        min="0"
                        className="h-12 rounded-lg transition-all duration-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      data-testid="has-emergency-checkbox"
                      id="has_emergency_dept"
                      checked={formData.has_emergency_dept}
                      onCheckedChange={(checked) => setFormData({...formData, has_emergency_dept: checked})}
                    />
                    <Label htmlFor="has_emergency_dept" className="cursor-pointer">Has Emergency Department</Label>
                  </div>
                  <div>
                    <Label>Services (MRI, CT, Physiotherapy, etc.)</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        data-testid="service-input"
                        value={serviceInput}
                        onChange={(e) => setServiceInput(e.target.value)}
                        placeholder="Add a service"
                        className="h-12 rounded-lg transition-all duration-500"
                      />
                      <Button data-testid="add-service-button" type="button" onClick={addService}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.services.map((service, idx) => (
                        <div key={idx} data-testid={`service-${idx}`} className="px-3 py-1 bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 rounded-full text-sm flex items-center gap-2 transition-colors duration-500">
                          {service}
                          <button type="button" onClick={() => removeService(idx)}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                {step > 1 && (
                  <Button data-testid="back-step-button" type="button" onClick={() => setStep(step - 1)} variant="outline" className="flex-1">
                    Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button data-testid="next-step-button" type="button" onClick={() => setStep(step + 1)} className="flex-1">
                    Next
                  </Button>
                ) : (
                  <Button data-testid="submit-hospital-button" type="submit" disabled={loading} className="flex-1">
                    {loading ? 'Registering...' : 'Register Hospital'}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
};

export default HospitalRegistration;