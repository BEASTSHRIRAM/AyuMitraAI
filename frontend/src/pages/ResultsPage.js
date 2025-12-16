import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import UrgencyBadge from '../components/UrgencyBadge';
import { ArrowLeft, MapPin, Phone, Clock, Building2, User } from 'lucide-react';

const ResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { analysis } = location.state || {};

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="mb-4">No analysis data available</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { routing_decision, processing_time_ms } = analysis;
  const { urgency, primary_specialty, alternative_specialties, recommended_facilities, recommended_actions } = routing_decision;

  return (
    <div data-testid="results-page" className="min-h-screen py-12 px-6 transition-colors duration-500">
      <div className="max-w-5xl mx-auto">
        <Button
          data-testid="back-button"
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-slate-100 transition-colors duration-500" style={{ fontFamily: 'Manrope, sans-serif' }}>Analysis Results</h1>
          <p className="text-slate-600 dark:text-slate-400 transition-colors duration-500">Analyzed in {processing_time_ms.toFixed(0)}ms</p>
        </div>

        <div className="space-y-6">
          <UrgencyBadge level={urgency.level} score={urgency.score} />

          <Card data-testid="urgency-details-card" className="border-l-4 border-l-teal-500 transition-colors duration-500">
            <CardHeader>
              <CardTitle>Urgency Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 dark:text-slate-300 transition-colors duration-500">{urgency.justification}</p>
            </CardContent>
          </Card>

          <Card data-testid="recommended-actions-card" className="transition-colors duration-500">
            <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {recommended_actions.map((action, idx) => (
                  <li key={idx} data-testid={`action-${idx}`} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg transition-colors duration-500">
                    <span className="text-teal-600 dark:text-teal-400 font-bold mt-1">•</span>
                    <span className="flex-1 text-slate-700 dark:text-slate-300 transition-colors duration-500">{action}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card data-testid="primary-specialty-card" className="bg-gradient-to-br from-teal-50 to-sky-50 dark:from-teal-950/20 dark:to-sky-950/20 transition-colors duration-500">
            <CardHeader>
              <CardTitle>Primary Recommended Specialty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-teal-700 dark:text-teal-300 transition-colors duration-500" style={{ fontFamily: 'Manrope, sans-serif' }}>{primary_specialty.specialty}</h3>
                <p className="text-sm font-mono text-slate-600 dark:text-slate-400 transition-colors duration-500">Confidence: {(primary_specialty.confidence * 100).toFixed(1)}%</p>
                <div>
                  <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300 transition-colors duration-500">Based on:</p>
                  <ul className="space-y-1">
                    {primary_specialty.reasons.map((reason, idx) => (
                      <li key={idx} className="text-sm text-slate-600 dark:text-slate-400 transition-colors duration-500">• {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {alternative_specialties && alternative_specialties.length > 0 && (
            <Card data-testid="alternative-specialties-card" className="transition-colors duration-500">
              <CardHeader>
                <CardTitle>Alternative Specialties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {alternative_specialties.map((alt, idx) => (
                    <div key={idx} data-testid={`alt-specialty-${idx}`} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors duration-500">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 transition-colors duration-500">{alt.specialty}</h4>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-500 transition-colors duration-500">Confidence: {(alt.confidence * 100).toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recommended_facilities && recommended_facilities.length > 0 && (
            <Card data-testid="facilities-card" className="transition-colors duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Recommended Facilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommended_facilities.map((facility, idx) => (
                    <div key={idx} data-testid={`facility-${idx}`} className="p-6 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-teal-500 dark:hover:border-teal-500 transition-all duration-500">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 transition-colors duration-500" style={{ fontFamily: 'Manrope, sans-serif' }}>{facility.facility_name}</h4>
                          <span className="inline-block px-3 py-1 bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 text-xs font-semibold rounded-full mt-2 capitalize transition-colors duration-500">
                            {facility.facility_type}
                          </span>
                        </div>
                        {facility.emergency_capable && (
                          <span className="px-3 py-1 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full transition-colors duration-500">
                            Emergency
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 transition-colors duration-500">
                        {facility.doctor_name && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>Dr. {facility.doctor_name} - {facility.doctor_specialization}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{facility.availability}</span>
                        </div>
                        {facility.contact && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{facility.contact}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 transition-colors duration-500">
            <CardContent className="p-6">
              <p className="text-sm text-amber-900 dark:text-amber-300 transition-colors duration-500">
                <strong>Disclaimer:</strong> {routing_decision.disclaimer}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;