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
  CreditCard, X, Plus, History, ChevronRight, Calendar,
  MessageSquarePlus, Menu, Search, Globe, FileText
} from 'lucide-react';
import PaymentGateway from '../components/PaymentGateway';
import AgentTracePanel from '../components/AgentTracePanel';
import { generatePrescriptionPDF } from '../utils/prescriptionPDF';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

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
  const [triageGuidance, setTriageGuidance] = useState(null); // { actions, warnings, urgency_level, specialty }
  const pollIntervalRef = useRef(null);

  // Web search state
  const [webDoctors, setWebDoctors] = useState([]);
  const [loadingWebSearch, setLoadingWebSearch] = useState(false);
  const [showWebDoctors, setShowWebDoctors] = useState(false);

  // Agent trace state
  const [showAgentTrace, setShowAgentTrace] = useState(false);
  const [agentTraceKey, setAgentTraceKey] = useState(0); // force remount

  // Prescription state
  const [downloadingPrescription, setDownloadingPrescription] = useState(false);

  // Check screen size
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadHistory();

    // Restore active session from localStorage (survives page reload & registration)
    const savedRequestId = localStorage.getItem('ayumitra_request_id');
    const savedDoctors = localStorage.getItem('ayumitra_matched_doctors');
    if (savedRequestId && savedDoctors) {
      try {
        const doctors = JSON.parse(savedDoctors);
        setRequestId(savedRequestId);
        setMatchedDoctors(doctors);
        setRequestStatus('pending');
        startPolling(savedRequestId);

        // Link request if user just logged in/registered
        const token = localStorage.getItem('ayumitra-token');
        if (token) {
          api.post(`/patient/link-request/${savedRequestId}`).then(() => {
            loadHistory();
          }).catch(err => {
            console.error('Failed to link request:', err);
          });
        }
      } catch (e) {
        localStorage.removeItem('ayumitra_request_id');
        localStorage.removeItem('ayumitra_matched_doctors');
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const loadHistory = async () => {
    try {
      // Skip loading history for unauthenticated users
      const token = localStorage.getItem('ayumitra-token');
      if (!token) {
        setConsultationHistory([]);
        setLoadingHistory(false);
        return;
      }

      const response = await api.get('/patient/history');
      setConsultationHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load history:', error);
      setConsultationHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewSession = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    // Clear persisted session
    localStorage.removeItem('ayumitra_request_id');
    localStorage.removeItem('ayumitra_matched_doctors');
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
    setWebDoctors([]);
    setShowWebDoctors(false);
    setShowAgentTrace(false);
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
    if (!symptomDescription.trim()) {
      toast.error('Please describe your symptoms');
      return;
    }
    // Show the agent trace panel — it will handle the stream itself
    setShowAgentTrace(true);
    setAgentTraceKey(k => k + 1);
  };

  const handleAgentTraceDone = ({ request_id, matching_doctors, primary_specialty, urgency_level, urgency_score, recommended_actions, critical_warnings }) => {
    const doctors = matching_doctors || [];
    if (doctors.length === 0) {
      toast.error('No doctors available at the moment.');
      setShowAgentTrace(false);
      return;
    }
    localStorage.setItem('ayumitra_request_id', request_id);
    localStorage.setItem('ayumitra_matched_doctors', JSON.stringify(doctors));
    setRequestId(request_id);
    setMatchedDoctors(doctors);
    setRequestStatus('pending');
    setShowAgentTrace(false);
    // Store triage guidance from the SSE stream result
    if (recommended_actions || critical_warnings) {
      setTriageGuidance({
        actions: recommended_actions || [],
        warnings: critical_warnings || [],
        urgency_level: urgency_level || 'moderate',
        specialty: primary_specialty || 'General Medicine',
      });
    }
    toast.success(`Found ${doctors.length} matching doctor${doctors.length !== 1 ? 's' : ''}!`);
    startPolling(request_id);
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
        
        // Capture triage guidance from polling if not already set
        if (!triageGuidance && (data.recommended_actions?.length || data.critical_warnings?.length)) {
          setTriageGuidance({
            actions: data.recommended_actions || [],
            warnings: data.critical_warnings || [],
            urgency_level: data.urgency_level || 'moderate',
            specialty: data.primary_specialty || 'General Medicine',
          });
        }

        if (data.status === 'accepted' && data.assigned_doctor) {
          setAssignedDoctor(data.assigned_doctor);
          if (!assignedDoctor) {
            toast.success(`Dr. ${data.assigned_doctor.name} accepted!`);
          }
        }
        
        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          // Clear persisted session once completed
          localStorage.removeItem('ayumitra_request_id');
          localStorage.removeItem('ayumitra_matched_doctors');
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
    if (!localStorage.getItem('ayumitra-token')) {
      toast.info('Please sign up or login to make payments and save your records');
      window.location.href = '/signup';
      return;
    }
    setShowPaymentGateway(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentGateway(false);
    toast.success(`Payment successful!`);
    loadHistory();
    startNewSession();
  };

  const handleDownloadPrescription = async () => {
    setDownloadingPrescription(true);
    try {
      const token = localStorage.getItem('ayumitra-token');
      if (!token) return;

      const res = await api.get(`/patient/prescription/request/${requestId}`);
      const rx = res.data;

      generatePrescriptionPDF({
        patientName: rx.patient_name || 'Patient',
        patientAge: patientAge || '',
        doctorName: rx.doctor_name || 'Doctor',
        doctorSpecialty: rx.doctor_specialty || '',
        symptoms: rx.symptoms || '',
        notes: rx.notes || '',
        medications: rx.medications || [],
        date: rx.created_at || new Date().toISOString(),
        prescriptionId: rx.prescription_id
      });

      toast.success('Prescription PDF downloaded successfully!');
    } catch (err) {
      toast.error('Prescription details not found or not ready yet.');
    } finally {
      setDownloadingPrescription(false);
    }
  };

  const handleSearchFromWeb = async () => {
    if (!symptomDescription.trim()) {
      toast.error('Please describe your symptoms first');
      return;
    }

    setLoadingWebSearch(true);
    try {
      const response = await api.post('/search/doctors/hybrid', {
        symptoms: symptomDescription,
        location: 'India', // Default location, could be made dynamic
        limit: 10
      });

      const webDoctorsOnly = response.data.doctors.filter(doc => doc.source === 'web_search');
      setWebDoctors(webDoctorsOnly);
      setShowWebDoctors(true);
      toast.success(`Found ${webDoctorsOnly.length} doctors from web search!`);
    } catch (error) {
      toast.error('Failed to search doctors from web');
      console.error('Web search error:', error);
    } finally {
      setLoadingWebSearch(false);
    }
  };

  const handleConnectWebDoctor = async (doctor) => {
    try {
      // Check if user is authenticated
      const token = localStorage.getItem('ayumitra-token');
      
      if (!token) {
        // Redirect to signup/login page
        toast.info('Please sign up or login to connect with doctors');
        window.location.href = '/signup';
        return;
      }

      // If authenticated, proceed with connection
      const user = JSON.parse(localStorage.getItem('ayumitra-user') || '{}');
      const patientName = user.full_name || 'Patient';
      const patientPhone = user.phone || '';

      const response = await api.post('/connect/doctor/web', {
        patient_name: patientName,
        patient_phone: patientPhone,
        symptoms: symptomDescription,
        doctor_name: doctor.name,
        doctor_phone: doctor.mobile
      });

      toast.success('Connection request sent! You can contact the doctor directly.');
    } catch (error) {
      toast.error('Failed to connect with doctor');
      console.error('Connect error:', error);
    }
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
    <>
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
            {!selectedHistory && !matchedDoctors && !showAgentTrace && (
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
                      disabled={symptomDescription.trim().length < 10}
                      className="w-full rounded-full py-5 sm:py-6 text-base sm:text-lg font-semibold"
                    >
                      Connect with Doctor (AI Triage)
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Agent Trace Panel */}
            {showAgentTrace && (
              <div className="space-y-4">
                <AgentTracePanel
                  key={agentTraceKey}
                  symptoms={symptomDescription}
                  patientAge={patientAge}
                  patientName={null}
                  backendUrl={BACKEND_URL}
                  onComplete={handleAgentTraceDone}
                  onError={(msg) => {
                    toast.error('Agent pipeline failed: ' + msg);
                    setShowAgentTrace(false);
                  }}
                />
                <button
                  onClick={() => setShowAgentTrace(false)}
                  style={{
                    background: 'none', border: '1px solid #334155', color: '#94a3b8',
                    borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', width: '100%'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Active Session */}
            {matchedDoctors && (
              <div className="space-y-4 sm:space-y-6">
                {/* Account Registration Prompt if not logged in */}
                {!localStorage.getItem('ayumitra-token') && (
                  <Card className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                    <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 mt-2 rounded-full bg-amber-500 flex-shrink-0" />
                        <div>
                          <h3 className="font-bold text-amber-800 dark:text-amber-200">Registration Required</h3>

                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            Please register or sign in to finalize your booking, secure your consultation details, and complete payment.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                        <Button onClick={() => window.location.href='/signup'} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-full px-5">
                          Register
                        </Button>
                        <Button onClick={() => window.location.href='/login'} variant="outline" className="border-amber-600 text-amber-700 hover:bg-amber-100 font-semibold rounded-full px-5">
                          Login
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Card */}
                {showPayment && (
                  <Card className="border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300 text-lg">
                        <CreditCard className="w-5 h-5" />
                        Consultation Complete
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* ... existing payment content ... */}
                      {localStorage.getItem('ayumitra-token') && (
                        <div className="mt-4 pt-4 border-t border-teal-200 dark:border-teal-800">
                          <Button
                            id="generate-prescription-btn"
                            onClick={handleDownloadPrescription}
                            disabled={downloadingPrescription}
                            className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                          >
                            {downloadingPrescription ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Downloading...
                              </>
                            ) : (
                              <>
                                <FileText className="w-4 h-4 mr-2" />
                                Download Prescription PDF
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Original Payment Required Card */}
                {showPayment && assignedDoctor && (
                  <Card className="border-2 border-blue-400 bg-blue-50 dark:bg-blue-950/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-lg">
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

                {/* While You Wait — First-Aid Guidance */}
                {!showPayment && triageGuidance && (triageGuidance.actions.length > 0 || triageGuidance.warnings.length > 0) && (
                  <Card className={`border-2 ${
                    triageGuidance.urgency_level === 'critical'
                      ? 'border-red-400 bg-red-50 dark:bg-red-950/30'
                      : triageGuidance.urgency_level === 'moderate'
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                  }`}>
                    <CardHeader className="pb-3">
                      <CardTitle className={`text-base flex items-center gap-2 ${
                        triageGuidance.urgency_level === 'critical' ? 'text-red-700 dark:text-red-300'
                        : triageGuidance.urgency_level === 'moderate' ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                      }`}>
                        <span className={`w-2 h-2 rounded-full inline-block ${
                          triageGuidance.urgency_level === 'critical' ? 'bg-red-500 animate-pulse'
                          : triageGuidance.urgency_level === 'moderate' ? 'bg-amber-500'
                          : 'bg-emerald-500'
                        }`} />
                        While You Wait — {triageGuidance.specialty}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {triageGuidance.warnings.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Important Warnings</p>
                          {triageGuidance.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                              <span className="mt-0.5 flex-shrink-0 text-red-500">!</span>
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {triageGuidance.actions.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recommended Steps</p>
                          {triageGuidance.actions.map((action, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className={`mt-1 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${
                                triageGuidance.urgency_level === 'critical' ? 'bg-red-500'
                                : triageGuidance.urgency_level === 'moderate' ? 'bg-amber-500'
                                : 'bg-emerald-500'
                              }`}>{i + 1}</span>
                              <span className="text-slate-700 dark:text-slate-300">{action}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-2 border-t pt-2">This is AI-generated guidance only. Follow your doctor's advice.</p>
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
                      
                      {/* Search from Web Button */}
                      <div className="mt-4 pt-4 border-t">
                        <Button 
                          onClick={handleSearchFromWeb}
                          disabled={loadingWebSearch}
                          variant="outline" 
                          className="w-full rounded-full"
                        >
                          {loadingWebSearch ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Searching web...
                            </>
                          ) : (
                            <>
                              <Globe className="w-4 h-4 mr-2" />
                              Search More Doctors from Web
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Web Doctors List */}
                {showWebDoctors && webDoctors.length > 0 && (
                  <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-lg">
                        <Globe className="w-5 h-5" />
                        Doctors from Web ({webDoctors.length})
                      </CardTitle>
                      <CardDescription className="text-orange-600 dark:text-orange-400 text-sm">
                        These doctors were found through web search. Contact them directly.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {webDoctors.map((doctor, index) => (
                          <div key={index} className="bg-white dark:bg-slate-800 rounded-lg p-4 border">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base">Dr. {doctor.name}</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{doctor.specialization}</p>
                                {doctor.experience && (
                                  <p className="text-xs text-slate-500 mt-1">{doctor.experience}</p>
                                )}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-sm">
                                  {doctor.mobile && (
                                    <a href={`tel:${doctor.mobile}`} className="flex items-center gap-1 text-orange-600">
                                      <Phone className="w-4 h-4" />
                                      {doctor.mobile}
                                    </a>
                                  )}
                                  {doctor.location && (
                                    <span className="flex items-center gap-1 text-slate-500 truncate">
                                      <MapPin className="w-4 h-4 flex-shrink-0" />
                                      {doctor.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button 
                                onClick={() => handleConnectWebDoctor(doctor)}
                                size="sm"
                                className="ml-3 bg-orange-600 hover:bg-orange-700 text-white"
                              >
                                Connect
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* No Doctors Found - Show Web Search Option */}
                {!assignedDoctor && matchedDoctors && matchedDoctors.length === 0 && (
                  <Card className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-amber-700 dark:text-amber-300 text-lg">No Registered Doctors Available</CardTitle>
                      <CardDescription className="text-amber-600 dark:text-amber-400">
                        Try searching for doctors from the web instead.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={handleSearchFromWeb}
                        disabled={loadingWebSearch}
                        className="w-full rounded-full bg-amber-600 hover:bg-amber-700"
                      >
                        {loadingWebSearch ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Searching web...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Search Doctors from Web
                          </>
                        )}
                      </Button>
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

    </>
  );
};

export default PatientDashboard;
