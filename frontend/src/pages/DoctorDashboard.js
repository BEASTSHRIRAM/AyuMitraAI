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
import { Stethoscope, Users, CheckCircle, Clock, Plus, Trash2, Power, X, Receipt, Syringe, Bandage } from 'lucide-react';
import UrgencyBadge from '../components/UrgencyBadge';

// Completion Modal Component
const CompletionModal = ({ request, onClose, onComplete }) => {
  const [consultationFee, setConsultationFee] = useState(500);
  const [additionalCharges, setAdditionalCharges] = useState([]);
  const [notes, setNotes] = useState('');
  const [customItem, setCustomItem] = useState({ name: '', price: '' });

  const predefinedItems = [
    { name: 'Syringe', price: 20, icon: Syringe },
    { name: 'Bandage', price: 30, icon: Bandage },
    { name: 'Cotton', price: 15, icon: Bandage },
    { name: 'Injection', price: 100, icon: Syringe },
    { name: 'IV Drip', price: 250, icon: Syringe },
    { name: 'Dressing', price: 50, icon: Bandage },
    { name: 'X-Ray', price: 500, icon: Receipt },
    { name: 'Blood Test', price: 300, icon: Syringe },
  ];

  const addPredefinedItem = (item) => {
    const existing = additionalCharges.find(c => c.name === item.name);
    if (existing) {
      setAdditionalCharges(additionalCharges.map(c => 
        c.name === item.name ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setAdditionalCharges([...additionalCharges, { ...item, quantity: 1 }]);
    }
  };

  const addCustomItem = () => {
    if (customItem.name && customItem.price) {
      setAdditionalCharges([...additionalCharges, {
        name: customItem.name,
        price: parseFloat(customItem.price),
        quantity: 1
      }]);
      setCustomItem({ name: '', price: '' });
    }
  };

  const removeItem = (index) => {
    setAdditionalCharges(additionalCharges.filter((_, i) => i !== index));
  };

  const updateQuantity = (index, delta) => {
    setAdditionalCharges(additionalCharges.map((item, i) => {
      if (i === index) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const platformFee = 50;
  const additionalTotal = additionalCharges.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const grandTotal = consultationFee + additionalTotal + platformFee;

  const handleComplete = () => {
    const billBreakdown = {
      consultation_fee: consultationFee,
      additional_charges: additionalCharges.map(item => ({
        name: item.name,
        amount: item.price * item.quantity,
        quantity: item.quantity,
        unit_price: item.price
      })),
      platform_fee: platformFee,
      total: grandTotal,
      notes: notes
    };
    onComplete(request.request_id, billBreakdown);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
            <div>
              <p className="font-bold text-sm sm:text-base">Complete Consultation</p>
              <p className="text-xs sm:text-sm opacity-80">{request.patient_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
          {/* Consultation Fee */}
          <div>
            <Label className="text-sm">Consultation Fee (₹)</Label>
            <Input
              type="number"
              value={consultationFee}
              onChange={(e) => setConsultationFee(parseInt(e.target.value) || 0)}
              className="mt-1 h-10 sm:h-11"
            />
          </div>

          {/* Quick Add Items */}
          <div>
            <Label className="mb-2 block text-sm">Quick Add Items</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {predefinedItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => addPredefinedItem(item)}
                  className="p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left flex items-center gap-2"
                >
                  <item.icon className="w-4 h-4 text-teal-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">₹{item.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Item */}
          <div>
            <Label className="mb-2 block text-sm">Add Custom Item</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Item name"
                value={customItem.name}
                onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                className="flex-1 h-10"
              />
              <Input
                type="number"
                placeholder="₹"
                value={customItem.price}
                onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
                className="w-20 h-10"
              />
              <Button onClick={addCustomItem} size="sm" className="h-10 px-3">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Added Items */}
          {additionalCharges.length > 0 && (
            <div>
              <Label className="mb-2 block text-sm">Added Items</Label>
              <div className="space-y-2">
                {additionalCharges.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">₹{item.price} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 ml-2">
                      <div className="flex items-center border rounded text-sm">
                        <button 
                          onClick={() => updateQuantity(index, -1)}
                          className="px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >-</button>
                        <span className="px-2">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(index, 1)}
                          className="px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >+</button>
                      </div>
                      <span className="font-medium text-sm w-14 text-right">₹{item.price * item.quantity}</span>
                      <button onClick={() => removeItem(index)} className="text-red-500 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-sm">Notes (Optional)</Label>
            <Input
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-10"
            />
          </div>
        </div>

        {/* Bill Summary */}
        <div className="border-t p-3 sm:p-4 bg-slate-50 dark:bg-slate-800">
          <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-4 text-sm">
            <div className="flex justify-between">
              <span>Consultation</span>
              <span>₹{consultationFee}</span>
            </div>
            {additionalCharges.length > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Additional ({additionalCharges.length})</span>
                <span>₹{additionalTotal}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Platform Fee</span>
              <span>₹{platformFee}</span>
            </div>
            <hr />
            <div className="flex justify-between font-bold text-base sm:text-lg">
              <span>Total</span>
              <span className="text-teal-600">₹{grandTotal}</span>
            </div>
          </div>
          <Button onClick={handleComplete} className="w-full py-5 sm:py-6 bg-teal-600 hover:bg-teal-700">
            <CheckCircle className="w-5 h-5 mr-2" />
            Complete & Send Bill
          </Button>
        </div>
      </Card>
    </div>
  );
};

const DoctorDashboard = () => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingRequest, setCompletingRequest] = useState(null);
  const [activeTab, setActiveTab] = useState('requests');

  useEffect(() => {
    fetchDoctorData();
  }, []);

  const fetchDoctorData = async () => {
    try {
      const [profileRes, statsRes, requestsRes] = await Promise.all([
        api.get('/doctor/profile'),
        api.get('/doctor/stats'),
        api.get('/doctor/requests')
      ]);
      
      setProfile(profileRes.data);
      setStats(statsRes.data);
      setRequests(requestsRes.data || []);
      setIsOnline(profileRes.data.availability?.is_online || false);
      setTimeSlots(profileRes.data.availability?.time_slots || []);
    } catch (error) {
      console.error('Failed to load doctor data:', error);
      if (loading) {
        toast.error('Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
      toast.error(error.response?.data?.detail || 'Failed to update status');
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
      toast.success('Availability saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await api.post(`/doctor/request/${requestId}/accept`);
      toast.success('Request accepted');
      fetchDoctorData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept');
    }
  };

  const handleCompleteWithBill = async (requestId, billBreakdown) => {
    try {
      await api.post(`/doctor/request/${requestId}/complete`, { bill_breakdown: billBreakdown });
      toast.success('Consultation completed!');
      setCompletingRequest(null);
      fetchDoctorData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Stethoscope className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse mx-auto mb-4 text-teal-500" />
          <p className="text-sm sm:text-base">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 sm:pb-6">
      {/* Completion Modal */}
      {completingRequest && (
        <CompletionModal
          request={completingRequest}
          onClose={() => setCompletingRequest(null)}
          onComplete={handleCompleteWithBill}
        />
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Dr. {profile?.full_name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
                {profile?.specialization} • {profile?.facility_name}
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-full">
                <Power className={`w-4 h-4 sm:w-5 sm:h-5 ${isOnline ? 'text-green-500' : 'text-slate-400'}`} />
                <span className="text-xs sm:text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
                <Switch checked={isOnline} onCheckedChange={toggleOnlineStatus} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-4 sm:mb-8">
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Requests</p>
                  <p className="text-xl sm:text-3xl font-bold mt-1">{stats?.total_requests || 0}</p>
                </div>
                <div className="hidden sm:flex w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Pending</p>
                  <p className="text-xl sm:text-3xl font-bold mt-1">{stats?.pending_requests || 0}</p>
                </div>
                <div className="hidden sm:flex w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900 items-center justify-center">
                  <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Treated</p>
                  <p className="text-xl sm:text-3xl font-bold mt-1">{stats?.patients_treated || 0}</p>
                </div>
                <div className="hidden sm:flex w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Tabs */}
        <div className="flex gap-2 mb-4 lg:hidden">
          <Button 
            variant={activeTab === 'requests' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('requests')}
            className="flex-1"
            size="sm"
          >
            Requests
          </Button>
          <Button 
            variant={activeTab === 'availability' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('availability')}
            className="flex-1"
            size="sm"
          >
            Availability
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Patient Requests */}
          <Card className={`${activeTab !== 'requests' ? 'hidden lg:block' : ''}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl">Patient Requests</CardTitle>
              <CardDescription className="text-sm">Manage consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4 max-h-[50vh] sm:max-h-[600px] overflow-y-auto">
                {requests.length === 0 ? (
                  <p className="text-center text-slate-500 py-8 text-sm">No requests yet</p>
                ) : (
                  requests.map((request) => (
                    <div key={request.request_id} className="border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm sm:text-base truncate">{request.patient_name}</p>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                            Age: {request.patient_age || 'N/A'}
                          </p>
                        </div>
                        <UrgencyBadge level={request.urgency_level} />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-medium mb-1">Symptoms:</p>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{request.symptoms}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="text-xs" variant={
                          request.status === 'pending' ? 'default' :
                          request.status === 'accepted' ? 'secondary' :
                          request.status === 'completed' ? 'success' : 'destructive'
                        }>
                          {request.status}
                        </Badge>
                        <div className="flex gap-2">
                          {request.status === 'pending' && (
                            <Button size="sm" onClick={() => acceptRequest(request.request_id)} className="text-xs sm:text-sm">
                              Accept
                            </Button>
                          )}
                          {request.status === 'accepted' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setCompletingRequest(request)}
                              className="bg-teal-50 border-teal-500 text-teal-700 hover:bg-teal-100 text-xs sm:text-sm"
                            >
                              <Receipt className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
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
          <Card className={`${activeTab !== 'availability' ? 'hidden lg:block' : ''}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl">Availability</CardTitle>
              <CardDescription className="text-sm">Set your schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4 max-h-[50vh] sm:max-h-[600px] overflow-y-auto">
                {timeSlots.map((slot, index) => (
                  <div key={index} className="border rounded-lg p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Day</Label>
                      <Button size="sm" variant="ghost" onClick={() => removeTimeSlot(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <Select value={slot.day} onValueChange={(value) => updateTimeSlot(index, 'day', value)}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <Label className="text-xs sm:text-sm">Start</Label>
                        <Input type="time" value={slot.start_time} onChange={(e) => updateTimeSlot(index, 'start_time', e.target.value)} className="h-10 mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">End</Label>
                        <Input type="time" value={slot.end_time} onChange={(e) => updateTimeSlot(index, 'end_time', e.target.value)} className="h-10 mt-1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <Label className="text-xs sm:text-sm">Duration (min)</Label>
                        <Input type="number" value={slot.slot_duration_minutes} onChange={(e) => updateTimeSlot(index, 'slot_duration_minutes', parseInt(e.target.value))} min="10" max="120" className="h-10 mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm">Max Patients</Label>
                        <Input type="number" value={slot.max_patients} onChange={(e) => updateTimeSlot(index, 'max_patients', parseInt(e.target.value))} min="1" className="h-10 mt-1" />
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
