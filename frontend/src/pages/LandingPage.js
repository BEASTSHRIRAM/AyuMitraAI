import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Activity, Heart, Users, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';

const LandingPage = () => {
  return (
    <div data-testid="landing-page" className="min-h-screen transition-colors duration-500">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 via-sky-500/20 to-transparent blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 dark:bg-teal-950/30 rounded-full text-teal-700 dark:text-teal-300 text-sm font-medium transition-colors duration-500">
              <Activity className="w-4 h-4" />
              AI-Powered Medical Routing
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <span className="bg-gradient-to-r from-teal-600 to-sky-600 dark:from-teal-400 dark:to-sky-400 bg-clip-text text-transparent">AyuMitraAI</span>
              <br />
              <span className="text-slate-900 dark:text-slate-100 transition-colors duration-500">Your Healthcare Navigator</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto transition-colors duration-500">
              Describe your symptoms and let our AI guide you to the right specialist, instantly. Connect with clinics and hospitals tailored to your needs.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link to="/signup">
                <Button data-testid="get-started-button" size="lg" className="rounded-full px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                  Get Started <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button data-testid="sign-in-button" variant="outline" size="lg" className="rounded-full px-8 py-6 text-lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Activity,
                title: 'AI Symptom Analysis',
                description: 'Advanced LangChain + Cerebras AI analyzes symptoms and determines urgency in seconds',
                testId: 'feature-ai-analysis'
              },
              {
                icon: MapPin,
                title: 'Smart Facility Matching',
                description: 'Find the nearest clinics and hospitals with the right specialists for your condition',
                testId: 'feature-facility-matching'
              },
              {
                icon: Heart,
                title: 'Priority-Based Routing',
                description: 'Critical cases get emergency care recommendations, mild cases to primary care',
                testId: 'feature-priority-routing'
              }
            ].map((feature, idx) => (
              <div key={idx} data-testid={feature.testId} className="rounded-2xl p-8 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-all duration-500 backdrop-blur-sm">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100 transition-colors duration-500" style={{ fontFamily: 'Manrope, sans-serif' }}>{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 transition-colors duration-500">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <h2 className="text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100 transition-colors duration-500" style={{ fontFamily: 'Manrope, sans-serif' }}>For Healthcare Providers</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 transition-colors duration-500">Register your clinic or hospital to receive AI-matched patient referrals</p>
            <div className="flex gap-4 justify-center">
              <Link to="/clinic-registration">
                <Button data-testid="register-clinic-button" variant="outline" size="lg" className="rounded-full px-6 py-6">
                  Register Clinic
                </Button>
              </Link>
              <Link to="/hospital-registration">
                <Button data-testid="register-hospital-button" variant="outline" size="lg" className="rounded-full px-6 py-6">
                  Register Hospital
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;