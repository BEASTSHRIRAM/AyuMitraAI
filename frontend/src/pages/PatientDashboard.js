import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import api from '../utils/api';
import { toast } from 'sonner';
import { 
  Stethoscope, Loader2, Phone, MapPin, Clock, CheckCircle, Navigation, 
  CreditCard, X, Plus, History, ChevronRight, IndianRupee, Calendar,
  MessageSquarePlus, Menu, ChevronLeft
} from 'lucide-react';
import PaymentGateway from '../components/PaymentGateway';

const PatientDashboard = () => {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [consultationHistory, setConsultationHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Current session state
  const [symptomDescription, setSymptomDescription] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchedDoctors, setMatchedDoctors] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [requestStatus, setRequestStatus] = useState(null);
  const [assignedDoctor, setAssignedDoctor] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showPaymentGateway, setShowPaymentGateway] = useState(false);
  const [totalAmount, setTotalAmount] = useState(550);
  const [billBreakdown, setBillBreakdown] = useState(null);
  const pollIntervalRef = useRef(null);

  // Check screen size
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadHistory();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const loadHistory = async () => {
    try {
      const response = await api.get('/patient/history');
      setConsultationHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewSession = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setSelectedHistory(null);
    setSymptomDescription('');
    setPatientAge('');
    setMatchedDoctors(null);
    setRequestId(null);
    setRequestStatus(null);
    setAssignedDoctor(null);
    setShowPayment(false);
    setShowPaymentGateway(false);
    setTotalAmount(550);
    setBillBreakdown(null);
    if (isMobile) setSidebarOpen(false);
  };

  const viewHistoryItem = (item) => {
    setSelectedHistory(item);
    setMatchedDoctors(null);
    setRequestId(null);
    setRequestStatus(null);
    if (isMobile) setSidebarOpen(false);
  };

  const handleConnectWithDoctor = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/connect-with-doctor', {
        symptom_description: symptomDescription,
        patient_age: patientAge ? parseInt(patientAge) : null
      });
      
      const doctors = response.data.matching_doctors || [];
      
      if (doctors.length === 0) {
        toast.error('No doctors available at the moment. Please try again later.');
        setLoading(false);
        return;
      }
      
      setRequestId(response.data.request_id);
      setMatchedDoctors(doctors);
      setRequestStatus('pending');
      toast.success(`Found ${doctors.length} matching doctors!`);
      
      startPolling(response.data.request_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (reqId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await api.get(`/patient/request-status/${reqId}`);
        const data = response.data;
        
        setRequestStatus(data.status);
        
        if (data.status === 'accepted' && data.assigned_doctor) {
          setAssignedDoctor(data.assigned_doctor);
          if (!assignedDoctor) {
            toast.success(`Dr. ${data.assigned_doctor.name} accepted!`);
          }
        }
        
        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          if (data.bill_breakdown) {
            setBillBreakdown(data.bill_breakdown);
            setTotalAmount(data.bill_breakdown.total);
          }
          setShowPayment(true);
          toast.success('Consultation completed!');
          loadHistory();
        }
        
        if (data.status === 'rejected') {
          clearInterval(pollIntervalRef.current);
          toast.error('Request declined.');
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }, 600000);
  };

  const openDirections = () => {
    if (assignedDoctor?.facility_name) {
      const destination = encodeURIComponent(assignedDoctor.facility_name);
      window.open(`https://www.google.com/maps/search/?api=1&query=${destination}`, '_blank');
    }
  };

  const handlePayment = () => {
    setShowPaymentGateway(true);
  };

  const handlePaymentSuccess = (paymentData) => {
    setShowPaymentGateway(false);
    toast.success(`Payment successful!`);
    loadHistory();
    startNewSession();
  };

  const getStatusDisplay = () => {
    switch (requestStatus) {
      case 'pending':
        return { text: 'Waiting for Doctor', color: 'blue', icon: Clock };
      case 'accepted':
        return { text: 'Doctor Assigned', color: 'green', icon: CheckCircle };
      case 'completed':
        return { text: 'Completed', color: 'teal', icon: CheckCircle };
      case 'rejected':
        return { text: 'Declined', color: 'red', icon: X };
      default:
        return { text: 'Unknown', color: 'gray', icon: Clock };
    }
  };

  const status = getStatusDisplay();
  const StatusIcon = status.icon;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] relative">
      {/* Payment Gateway Modal */}
      {showPaymentGateway && (
        <PaymentGateway
          amount={totalAmount}
          doctorName={assignedDoctor?.name || 'Doctor'}
          billBreakdown={billBreakdown}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowPaymentGateway(false)}
        />
      )}

      {/* Mobile Overlay */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'}
        ${sidebarOpen ? 'w-72 sm:w-80' : 'w-0'} 
        transition-all duration-300 bg-slate-900 dark:bg-slate-950 flex flex-col overflow-hidden
      `}>
        <div className="p-3 sm:p-4 border-b border-slate-700 flex items-center gap-2">
          <Button 
            onClick={startNewSession}
            className="flex-1 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm"
            size="sm"
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            New Consultation
          </Button>
          {isMobile && (
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5 text-white" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-xs text-slate-500 px-2 py-2 uppercase tracking-wider">History</p>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : consultationHistory.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No consultations yet</p>
          ) : (
            <div className="space-y-1">
              {consultationHistory.map((item, index) => (
                <button
                  key={item.request_id || index}
                  onClick={() => viewHistoryItem(item)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedHistory?.request_id === item.request_id
                      ? 'bg-slate-700'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <History className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        {item.symptoms?.slice(0, 30) || 'Consultation'}...
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-slate-500">
                          {formatDate(item.requested_at)}
                        </span>
                        {item.total_paid && (
                          <span className="text-xs text-teal-400">₹{item.total_paid}</span>
                        )}
                      </div>
                      <Badge 
                        className={`mt-1 text-xs ${
                          item.status === 'completed' ? 'bg-green-900 text-green-300' :
                          item.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {item.status || 'analyzed'}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toggle Sidebar Button - Desktop */}
      {!isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-1/2 -translate-y-1/2 z-10 bg-slate-800 p-2 rounded-r-lg hover:bg-slate-700 transition hidden md:block"
          style={{ left: sidebarOpen ? '320px' : '0' }}
        >
          <ChevronRight className={`w-4 h-4 text-white transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 bg-white dark:bg-slate-900 border-b p-3 flex items-center gap-3 z-30">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold truncate">
            {selectedHistory ? 'History' : matchedDoctors ? 'Active Session' : 'New Consultation'}
          </h1>
        </div>

        <div className="p-4 sm:p-6">
          <div className="max-w-3xl mx-auto">
            {/* Header - Desktop */}
            <div className="text-center mb-6 sm:mb-8 hidden md:block">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 mb-4">
                <Stethoscope className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {selectedHistory ? 'Consultation Details' : 'Connect with a Doctor'}
              </h1>
              <p className="text-slate-500 text-sm sm:text-base">
                {selectedHistory ? 'View your past consultation' : 'Describe your symptoms'}
              </p>
            </div>

            {/* History View */}
            {selectedHistory && !matchedDoctors && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5" />
                    {formatDate(selectedHistory.requested_at)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-slate-500 text-sm">Symptoms</Label>
                    <p className="mt-1 text-sm sm:text-base">{selectedHistory.symptoms}</p>
                  </div>
                  
                  {selectedHistory.doctor_name && (
                    <div>
                      <Label className="text-slate-500 text-sm">Doctor</Label>
                      <p className="mt-1">Dr. {selectedHistory.doctor_name}</p>
                    </div>
                  )}

                  {selectedHistory.bill_breakdown && (
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 sm:p-4">
                      <Label className="text-slate-500 mb-2 block text-sm">Bill Summary</Label>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Consultation</span>
                          <span>₹{selectedHistory.bill_breakdown.consultation_fee}</span>
                        </div>
                        {selectedHistory.bill_breakdown.additional_charges?.map((charge, i) => (
                          <div key={i} className="flex justify-between text-slate-600">
                            <span>{charge.name}</span>
                            <span>₹{charge.amount}</span>
                          </div>
                        ))}
                        <hr className="my-2" />
                        <div className="flex justify-between font-bold">
                          <span>Total</span>
                          <span className="text-teal-600">₹{selectedHistory.bill_breakdown.total}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button onClick={startNewSession} className="w-full rounded-full">
                    <Plus className="w-4 h-4 mr-2" />
                    New Consultation
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* New Consultation Form */}
            {!selectedHistory && !matchedDoctors && (
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-lg sm:text-xl">What's bothering you?</CardTitle>
                  <CardDescription className="text-sm">Be detailed for accurate matching</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleConnectWithDoctor} className="space-y-4 sm:space-y-6">
                    <div>
                      <Label htmlFor="symptoms" className="text-sm sm:text-base font-semibold">Describe Your Symptoms</Label>
                      <Textarea
                        id="symptoms"
                        value={symptomDescription}
                        onChange={(e) => setSymptomDescription(e.target.value)}
                        placeholder="Example: I've been experiencing severe chest pain..."
                        rows={5}
                        required
                        minLength={10}
                        className="mt-2 text-sm sm:text-base resize-none rounded-xl"
                      />
                      <p className="text-xs text-slate-500 mt-1">{symptomDescription.length} characters</p>
                    </div>

                    <div>
                      <Label htmlFor="age">Age (Optional)</Label>
                      <Input
                        id="age"
                        type="number"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="35"
                        min="0"
                        max="150"
                        className="h-11 sm:h-12 rounded-lg mt-1"
                      />
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-300">
                        <strong>Disclaimer:</strong> AI guidance only. For emergencies, call emergency services.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || symptomDescription.trim().length < 10}
                      className="w-full rounded-full py-5 sm:py-6 text-base sm:text-lg font-semibold"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Finding doctors...
                        </>
                      ) : (
                        'Connect with Doctor'
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Active Session */}
            {matchedDoctors && (
              <div className="space-y-4 sm:space-y-6">
                {/* Payment Card */}
                {showPayment && (
                  <Card className="border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300 text-lg">
                        <CreditCard className="w-5 h-5" />
                        Payment Required
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4">
                        {billBreakdown ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Consultation</span>
                              <span>₹{billBreakdown.consultation_fee}</span>
                            </div>
                            {billBreakdown.additional_charges?.map((charge, i) => (
                              <div key={i} className="flex justify-between text-slate-600">
                                <span>{charge.name}</span>
                                <span>₹{charge.amount}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-slate-500">
                              <span>Platform Fee</span>
                              <span>₹{billBreakdown.platform_fee}</span>
                            </div>
                            <hr className="my-2" />
                            <div className="flex justify-between font-bold text-base">
                              <span>Total</span>
                              <span className="text-teal-600">₹{billBreakdown.total}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span className="text-teal-600">₹{totalAmount}</span>
                          </div>
                        )}
                      </div>
                      <Button onClick={handlePayment} className="w-full rounded-full py-5 sm:py-6">
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay ₹{totalAmount}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Status Card */}
                {!showPayment && (
                  <Card className="border-2 border-blue-500">
                    <CardContent className="pt-4 sm:pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs sm:text-sm text-slate-500 mb-1">Status</p>
                          <p className="text-xl sm:text-2xl font-bold">{status.text}</p>
                        </div>
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900">
                          <StatusIcon className={`w-6 h-6 sm:w-7 sm:h-7 text-blue-600 ${requestStatus === 'pending' ? 'animate-pulse' : ''}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Assigned Doctor */}
                {assignedDoctor && !showPayment && (
                  <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-green-700 dark:text-green-300 text-lg">✓ Your Doctor</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-teal-500 flex items-center justify-center text-white text-xl sm:text-2xl font-bold flex-shrink-0">
                          {assignedDoctor.name?.charAt(0) || 'D'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold">Dr. {assignedDoctor.name}</h3>
                          <p className="text-slate-600 dark:text-slate-400 text-sm">{assignedDoctor.specialization}</p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-sm">
                            {assignedDoctor.phone && (
                              <a href={`tel:${assignedDoctor.phone}`} className="flex items-center gap-1 text-teal-600">
                                <Phone className="w-4 h-4" />
                                {assignedDoctor.phone}
                              </a>
                            )}
                            {assignedDoctor.facility_name && (
                              <span className="flex items-center gap-1 text-slate-500 truncate">
                                <MapPin className="w-4 h-4 flex-shrink-0" />
                                {assignedDoctor.facility_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button onClick={openDirections} variant="outline" className="w-full rounded-full">
                        <Navigation className="w-4 h-4 mr-2" />
                        Get Directions
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Matched Doctors List */}
                {!assignedDoctor && matchedDoctors.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Notified Doctors ({matchedDoctors.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 sm:space-y-3">
                        {matchedDoctors.map((doctor) => (
                          <div key={doctor.doctor_id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm sm:text-base truncate">Dr. {doctor.name}</p>
                              <p className="text-xs sm:text-sm text-slate-500 truncate">{doctor.specialization}</p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-700 text-xs ml-2 flex-shrink-0">
                              {doctor.is_online ? 'Online' : 'Notified'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Cancel Button */}
                <Button onClick={startNewSession} variant="outline" className="w-full rounded-full py-5 sm:py-6">
                  {showPayment ? 'Done' : 'Cancel'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
