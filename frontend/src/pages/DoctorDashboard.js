import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import api from '../utils/api';
import { toast } from 'sonner';
import { Stethoscope, Users, CheckCircle, Clock, Plus, Trash2, Power } from 'lucide-react';
import UrgencyBadge from '../components/UrgencyBadge';

const DoctorDashboard = () => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctorData();
  }, []);

  const fetchDoctorData = async () => {
    try {
      // TODO: Create API endpoints for doctor profile, stats, and requests
      // For now, we'll use mock data from state
      const mockProfile = {
        full_name: 'John Doe',
        specialization: 'Cardiology',
        facility_name: 'City Hospital',
        facility_type: 'Hospital',
        availability: {
          is_online: false,
          time_slots: []
        }
      };
      
      const mockStats = {
        total_requests: 0,
        pending_requests: 0,
        patients_treated: 0
      };
      
      setProfile(mockProfile);
      setStats(mockStats);
      setRequests([]);
      setIsOnline(mockProfile.availability.is_online);
      setTimeSlots(mockProfile.availability.time_slots || []);
    } catch (error) {
      console.error('Failed to load doctor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const playNotificationSound = () => {
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  // Auto-refresh requests every 2 seconds for real-time updates
  React.useEffect(() => {
    const interval = setInterval(fetchDoctorData, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleOnlineStatus = async () => {
    try {
      await api.put('/doctor/availability', { 
        is_online: !isOnline,
        time_slots: timeSlots
      });
      setIsOnline(!isOnline);
      toast.success(`You are now ${!isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, {
      day: 'monday',
      start_time: '09:00',
      end_time: '17:00',
      slot_duration_minutes: 40,
      max_patients: 6
    }]);
  };

  const removeTimeSlot = (index) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index, field, value) => {
    const updated = [...timeSlots];
    updated[index][field] = value;
    setTimeSlots(updated);
  };

  const saveAvailability = async () => {
    try {
      await api.put('/doctor/availability', { 
        is_online: isOnline,
        time_slots: timeSlots 
      });
      toast.success('Availability updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update availability');
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      // TODO: Create API endpoint to accept request
      toast.success('Request accepted');
      fetchDoctorData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to accept request');
    }
  };

  const completeRequest = async (requestId) => {
    try {
      // TODO: Create API endpoint to complete request
      toast.success('Request completed');
      fetchDoctorData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to complete request');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Stethoscope className="w-12 h-12 animate-pulse mx-auto mb-4 text-teal-500" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6 transition-colors duration-500">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Dr. {profile?.full_name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {profile?.specialization} • {profile?.facility_name} ({profile?.facility_type})
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Power className={`w-5 h-5 ${isOnline ? 'text-green-500' : 'text-slate-400'}`} />
                <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
                <Switch checked={isOnline} onCheckedChange={toggleOnlineStatus} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Requests</p>
                  <p className="text-3xl font-bold mt-1">{stats?.total_requests || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Pending Requests</p>
                  <p className="text-3xl font-bold mt-1">{stats?.pending_requests || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Patients Treated</p>
                  <p className="text-3xl font-bold mt-1">{stats?.patients_treated || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Patient Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Requests</CardTitle>
              <CardDescription>Manage incoming patient consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {requests.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No patient requests yet</p>
                ) : (
                  requests.map((request) => (
                    <div key={request.request_id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{request.patient_name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Age: {request.patient_age || 'N/A'}
                          </p>
                        </div>
                        <UrgencyBadge level={request.urgency_level} />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Symptoms:</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{request.symptoms}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant={
                          request.status === 'pending' ? 'default' :
                          request.status === 'accepted' ? 'secondary' :
                          request.status === 'completed' ? 'success' : 'destructive'
                        }>
                          {request.status}
                        </Badge>
                        <div className="flex gap-2">
                          {request.status === 'pending' && (
                            <Button size="sm" onClick={() => acceptRequest(request.request_id)}>
                              Accept
                            </Button>
                          )}
                          {request.status === 'accepted' && (
                            <Button size="sm" variant="outline" onClick={() => completeRequest(request.request_id)}>
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Availability Management */}
          <Card>
            <CardHeader>
              <CardTitle>Availability & Time Slots</CardTitle>
              <CardDescription>Configure your working hours and appointment slots</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {timeSlots.map((slot, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Day of Week</Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTimeSlot(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <Select
                      value={slot.day}
                      onValueChange={(value) => updateTimeSlot(index, 'day', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">Monday</SelectItem>
                        <SelectItem value="tuesday">Tuesday</SelectItem>
                        <SelectItem value="wednesday">Wednesday</SelectItem>
                        <SelectItem value="thursday">Thursday</SelectItem>
                        <SelectItem value="friday">Friday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => updateTimeSlot(index, 'start_time', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => updateTimeSlot(index, 'end_time', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Slot Duration (mins)</Label>
                        <Input
                          type="number"
                          value={slot.slot_duration_minutes}
                          onChange={(e) => updateTimeSlot(index, 'slot_duration_minutes', parseInt(e.target.value))}
                          min="10"
                          max="120"
                        />
                      </div>
                      <div>
                        <Label>Max Patients</Label>
                        <Input
                          type="number"
                          value={slot.max_patients}
                          onChange={(e) => updateTimeSlot(index, 'max_patients', parseInt(e.target.value))}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button onClick={addTimeSlot} variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Time Slot
                </Button>

                {timeSlots.length > 0 && (
                  <Button onClick={saveAvailability} className="w-full">
                    Save Availability
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
