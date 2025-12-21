import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import api from '../utils/api';
import { toast } from 'sonner';
import { Stethoscope, Loader2, Phone, MapPin, Clock, CheckCircle } from 'lucide-react';
import UrgencyBadge from '../components/UrgencyBadge';

const PatientDashboard = () => {
  const [symptomDescription, setSymptomDescription] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchedDoctors, setMatchedDoctors] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const navigate = useNavigate();

  const handleConnectWithDoctor = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First, get nearby doctors based on symptoms
      const doctorsResponse = await api.post('/doctors/nearby', {
        limit: 10
      });
      
      const nearbyDoctors = doctorsResponse.data.doctors;
      
      if (nearbyDoctors.length === 0) {
        toast.error('No doctors available at the moment');
        setLoading(false);
        return;
      }

      // For now, connect with the first available doctor
      // In a real app, you'd let the patient choose
      const selectedDoctor = nearbyDoctors[0];
      
      const response = await api.post('/patient/connect-with-doctor', {
        doctor_id: selectedDoctor.doctor_id,
        symptom_description: symptomDescription,
        patient_age: patientAge ? parseInt(patientAge) : null
      });
      
      setRequestId(response.data.request_id);
      setMatchedDoctors(nearbyDoctors);
      setConnectionStatus(response.data.status);
      toast.success(`Request sent to Dr. ${selectedDoctor.full_name}!`);
      
      // Start polling for doctor response
      pollForDoctorResponse(response.data.request_id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const pollForDoctorResponse = async (reqId) => {
    const pollInterval = setInterval(async () => {
      try {
        // TODO: Create an API endpoint to check request status
        // For now, just poll the state
        console.log('Polling for doctor response on request:', reqId);
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const resetForm = () => {
    setSymptomDescription('');
    setPatientAge('');
    setMatchedDoctors(null);
    setRequestId(null);
    setConnectionStatus(null);
  };

  return (
    <div data-testid="patient-dashboard" className="min-h-screen py-12 px-6 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 mb-4">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-slate-100 transition-colors duration-500" style={{ fontFamily: 'Manrope, sans-serif' }}>Connect with a Doctor</h1>
          <p className="text-slate-600 dark:text-slate-400 transition-colors duration-500">Describe your symptoms and AI will connect you with available doctors</p>
        </div>

        {!matchedDoctors ? (
          <Card className="transition-colors duration-500">
            <CardHeader>
              <CardTitle>Tell us what you're experiencing</CardTitle>
              <CardDescription>Be as detailed as possible for accurate doctor matching</CardDescription>
            </CardHeader>
            <CardContent>
              <form data-testid="symptom-form" onSubmit={handleConnectWithDoctor} className="space-y-6">
                <div>
                  <Label htmlFor="symptoms" className="text-base font-semibold">Describe Your Symptoms</Label>
                  <Textarea
                    data-testid="symptom-textarea"
                    id="symptoms"
                    value={symptomDescription}
                    onChange={(e) => setSymptomDescription(e.target.value)}
                    placeholder="Example: I've been experiencing severe chest pain for the past 2 hours. It feels like pressure and radiates to my left arm. I also feel short of breath and slightly dizzy..."
                    rows={8}
                    required
                    minLength={10}
                    className="mt-2 text-base resize-none rounded-xl transition-all duration-500"
                  />
                  <p className="text-xs text-slate-500 mt-2">{symptomDescription.length} characters (minimum 10)</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="age">Age (Optional)</Label>
                    <Input
                      data-testid="age-input"
                      id="age"
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      placeholder="35"
                      min="0"
                      max="150"
                      className="h-12 rounded-lg transition-all duration-500"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 transition-colors duration-500">
                  <p className="text-sm text-amber-900 dark:text-amber-300 transition-colors duration-500">
                    <strong>Medical Disclaimer:</strong> This AI matching provides guidance only. It does not replace professional medical diagnosis. For emergencies, call your local emergency services immediately.
                  </p>
                </div>

                <Button
                  data-testid="connect-button"
                  type="submit"
                  disabled={loading || symptomDescription.trim().length === 0}
                  className="w-full rounded-full py-6 text-lg font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Finding available doctors...
                    </>
                  ) : (
                    'Connect with Doctor'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="transition-colors duration-500 border-teal-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Connection Status</p>
                    <p className="text-2xl font-bold">
                      {connectionStatus === 'accepted' ? '✓ Doctor Assigned' : '⏳ Waiting for Response'}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    connectionStatus === 'accepted' 
                      ? 'bg-green-100 dark:bg-green-900' 
                      : 'bg-blue-100 dark:bg-blue-900'
                  }`}>
                    {connectionStatus === 'accepted' ? (
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Available Doctors */}
            <Card className="transition-colors duration-500">
              <CardHeader>
                <CardTitle>Available Doctors ({matchedDoctors.length})</CardTitle>
                <CardDescription>These doctors match your symptoms and are currently online</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {matchedDoctors.map((doctor) => (
                    <div key={doctor.doctor_id} className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors duration-500">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-semibold">Dr. {doctor.name}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{doctor.specialization}</p>
                        </div>
                        <Badge variant="success" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                          Online
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Clock className="w-4 h-4" />
                          <span>{doctor.experience_years} years experience</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <MapPin className="w-4 h-4" />
                          <span>{doctor.facility_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button onClick={resetForm} variant="outline" className="flex-1 rounded-full py-6">
                Start Over
              </Button>
              <Button onClick={() => navigate('/dashboard')} className="flex-1 rounded-full py-6">
                Back to Dashboard
              </Button>
            </div>

            {connectionStatus === 'accepted' && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 transition-colors duration-500">
                <p className="text-sm text-green-900 dark:text-green-300">
                  <strong>✓ Success!</strong> A doctor has accepted your request. Check your notifications for contact details.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;