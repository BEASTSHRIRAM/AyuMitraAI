import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Search,
  FileText,
  Check,
  AlertTriangle,
  MapPin,
  Sparkles,
  Loader2,
  Phone,
  Stethoscope,
  Bot,
  Minus,
} from 'lucide-react';
import { Button } from '../components/ui/button';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

const AGENTS = [
  { id: 'triage_agent', name: 'Triage Agent', description: 'Analyzes symptoms and urgency', icon: Activity },
  { id: 'research_agent', name: 'Research Agent', description: 'Finds doctors near you', icon: Search },
  { id: 'report_agent', name: 'Report Agent', description: 'Writes your health summary', icon: FileText },
];

const AGENT_ORDER = ['triage_agent', 'research_agent', 'report_agent'];

const URGENCY_STYLES = {
  critical: {
    banner: 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300',
    badge: 'bg-red-600 text-white',
    bar: 'bg-red-500',
    label: 'Critical - seek care immediately',
  },
  moderate: {
    banner: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-500 text-white',
    bar: 'bg-amber-500',
    label: 'Moderate - see a doctor soon',
  },
  mild: {
    banner: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-600 text-white',
    bar: 'bg-emerald-500',
    label: 'Mild - monitor and self-care',
  },
};

const renderInline = (text, keyPrefix) =>
  text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={`${keyPrefix}-${i}`}>{part}</strong> : part
  );

const ReportMarkdown = ({ text }) => {
  const blocks = [];
  let list = [];
  const flushList = (key) => {
    if (list.length) {
      blocks.push(<ul key={key} className="list-disc pl-5 space-y-1">{list}</ul>);
      list = [];
    }
  };
  text.split('\n').forEach((raw, idx) => {
    const line = raw.trim();
    if (/^[-*]\s+/.test(line)) {
      list.push(
        <li key={`li-${idx}`}>{renderInline(line.replace(/^[-*]\s+/, ''), `li-${idx}`)}</li>
      );
      return;
    }
    flushList(`ul-${idx}`);
    if (!line) return;
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push(
        <h4 key={`h-${idx}`} className="font-semibold text-base mt-4 text-slate-900 dark:text-slate-100">
          {renderInline(heading[2], `h-${idx}`)}
        </h4>
      );
    } else {
      blocks.push(
        <p key={`p-${idx}`} className="leading-relaxed">{renderInline(line, `p-${idx}`)}</p>
      );
    }
  });
  flushList('ul-end');
  return <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">{blocks}</div>;
};

const AgentNode = ({ agent, status }) => {
  const Icon = agent.icon;
  const isActive = status === 'active';
  const isDone = status === 'done';
  const isSkipped = status === 'skipped';
  return (
    <div className="flex flex-col items-center text-center flex-1 min-w-[90px]">
      <div
        className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
          isDone || isActive
            ? 'bg-gradient-to-br from-teal-500 to-sky-500 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
        } ${isActive ? 'copilot-active-ring scale-110' : ''}`}
      >
        {isDone ? <Check className="w-6 h-6" /> : isSkipped ? <Minus className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
      </div>
      <p
        className={`mt-2 text-xs sm:text-sm font-semibold ${
          isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        {agent.name}
      </p>
      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
        {isSkipped ? 'Skipped' : agent.description}
      </p>
      {isActive && (
        <div className="flex gap-1 mt-1.5">
          <span className="copilot-dot w-1.5 h-1.5 rounded-full bg-teal-500" style={{ animationDelay: '0s' }} />
          <span className="copilot-dot w-1.5 h-1.5 rounded-full bg-teal-500" style={{ animationDelay: '0.15s' }} />
          <span className="copilot-dot w-1.5 h-1.5 rounded-full bg-teal-500" style={{ animationDelay: '0.3s' }} />
        </div>
      )}
    </div>
  );
};

const Connector = ({ done, active }) => (
  <div className="flex-1 h-1 mx-1 sm:mx-2 mt-7 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 max-w-[80px]">
    <div
      className={`h-full rounded-full transition-all duration-700 ${
        done
          ? 'w-full bg-gradient-to-r from-teal-500 to-sky-500'
          : active
          ? 'w-full copilot-connector-active'
          : 'w-0'
      }`}
    />
  </div>
);

const initialStatuses = { triage_agent: 'idle', research_agent: 'idle', report_agent: 'idle' };

const HealthCopilot = () => {
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [analysis, setAnalysis] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [timeline, setTimeline] = useState([]);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (analysis && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [analysis]);

  const pushTimeline = (text, tone = 'info') => {
    setTimeline((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, text, tone, at: new Date() }]);
  };

  const advance = (prev, completedAgent) => {
    const next = { ...prev, [completedAgent]: 'done' };
    const idx = AGENT_ORDER.indexOf(completedAgent);
    for (let i = idx + 1; i < AGENT_ORDER.length; i += 1) {
      if (next[AGENT_ORDER[i]] !== 'skipped') {
        next[AGENT_ORDER[i]] = 'active';
        break;
      }
    }
    return next;
  };

  const handleEvent = (evt) => {
    if (evt.event === 'start') {
      setStatuses({
        triage_agent: 'active',
        research_agent: evt.research_enabled ? 'idle' : 'skipped',
        report_agent: 'idle',
      });
      pushTimeline('Pipeline started. Triage Agent is analyzing your symptoms.');
      if (!evt.research_enabled) {
        pushTimeline('Research Agent skipped (no location provided).', 'muted');
      }
      return;
    }
    if (evt.event === 'agent_update') {
      const data = evt.data || {};
      if (evt.agent === 'triage_agent' && data.analysis) {
        setAnalysis(data.analysis);
        pushTimeline(
          `Triage complete: ${data.analysis.urgency_level || 'unknown'} urgency, suggested specialty ${
            data.analysis.primary_specialty || 'General Medicine'
          }.`
        );
      }
      if (evt.agent === 'research_agent') {
        const found = data.doctors || [];
        setDoctors(found);
        pushTimeline(`Research complete: ${found.length} doctor${found.length === 1 ? '' : 's'} found.`);
      }
      if (evt.agent === 'report_agent' && data.report) {
        setReport(data.report);
        pushTimeline('Report ready.');
      }
      if (data.error) {
        pushTimeline(data.error, 'warn');
      }
      setStatuses((prev) => advance(prev, evt.agent));
      return;
    }
    if (evt.event === 'error') {
      setError(evt.message || 'Something went wrong.');
      pushTimeline(evt.message || 'Pipeline error.', 'warn');
      return;
    }
    if (evt.event === 'end') {
      setRunning(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (symptoms.trim().length < 10 || running) return;
    setRunning(true);
    setStatuses(initialStatuses);
    setAnalysis(null);
    setDoctors([]);
    setReport('');
    setError('');
    setTimeline([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/copilot/triage/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptom_description: symptoms.trim(),
          patient_age: age ? Number(age) : null,
          location: location.trim() || null,
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status})`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // Read the SSE stream chunk by chunk
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        parts.forEach((part) => {
          const line = part.trim();
          if (!line.startsWith('data:')) return;
          try {
            handleEvent(JSON.parse(line.slice(5)));
          } catch (parseErr) {
            // Ignore malformed chunks
          }
        });
      }
    } catch (err) {
      setError('Could not reach the copilot. Is the backend running?');
    } finally {
      setRunning(false);
    }
  };

  const urgency = analysis ? URGENCY_STYLES[analysis.urgency_level] || URGENCY_STYLES.moderate : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <style>{`
        @keyframes copilot-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes copilot-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.45); }
          70% { box-shadow: 0 0 0 14px rgba(20, 184, 166, 0); }
          100% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0); }
        }
        @keyframes copilot-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes copilot-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        .copilot-fade-up { animation: copilot-fade-up 0.5s ease-out both; }
        .copilot-active-ring { animation: copilot-pulse-ring 1.6s ease-out infinite; }
        .copilot-connector-active {
          background: linear-gradient(90deg, #14b8a6, #0ea5e9, #14b8a6);
          background-size: 200% 100%;
          animation: copilot-shimmer 1.2s linear infinite;
        }
        .copilot-dot { animation: copilot-bounce 1.2s infinite ease-in-out; }
      `}</style>

      {/* Hero */}
      <div className="text-center mb-8 copilot-fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Multi-agent AI, powered by LangGraph
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-teal-600 to-sky-600 dark:from-teal-400 dark:to-sky-400 bg-clip-text text-transparent">
          AI Health Copilot
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
          Describe your symptoms and watch specialist AI agents triage, research doctors near you and write a
          personalised summary in real time.
        </p>
      </div>

      {/* Input card */}
      <form
        onSubmit={handleSubmit}
        className="copilot-fade-up bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4"
        style={{ animationDelay: '0.1s' }}
      >
        <textarea
          data-testid="copilot-symptoms-input"
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Describe your symptoms in detail, e.g. 'I have had a dull headache behind my eyes for 3 days, worse in the morning...'"
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="number"
            min="0"
            max="150"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Age (optional)"
            className="sm:w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <div className="relative flex-1">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City for doctor search (optional)"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <Button
            data-testid="copilot-submit-button"
            type="submit"
            disabled={running || symptoms.trim().length < 10}
            className="sm:w-auto bg-gradient-to-r from-teal-500 to-sky-500 hover:from-teal-600 hover:to-sky-600 text-white"
          >
            {running ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Agents working
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Bot className="w-4 h-4" /> Run Copilot
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Agent pipeline */}
      {(running || analysis) && (
        <div className="copilot-fade-up mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-5">
            Agent pipeline
          </p>
          <div className="flex items-start justify-between">
            <AgentNode agent={AGENTS[0]} status={statuses.triage_agent} />
            <Connector
              done={statuses.triage_agent === 'done'}
              active={statuses.triage_agent === 'active'}
            />
            <AgentNode agent={AGENTS[1]} status={statuses.research_agent} />
            <Connector
              done={statuses.research_agent === 'done' || statuses.research_agent === 'skipped'}
              active={statuses.research_agent === 'active'}
            />
            <AgentNode agent={AGENTS[2]} status={statuses.report_agent} />
          </div>

          {/* Activity timeline */}
          {timeline.length > 0 && (
            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
              {timeline.map((item) => (
                <div key={item.id} className="copilot-fade-up flex items-start gap-2 text-xs sm:text-sm">
                  <span
                    className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.tone === 'warn' ? 'bg-amber-500' : item.tone === 'muted' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-teal-500'
                    }`}
                  />
                  <span
                    className={
                      item.tone === 'warn'
                        ? 'text-amber-600 dark:text-amber-400'
                        : item.tone === 'muted'
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 dark:text-slate-300'
                    }
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="copilot-fade-up mt-6 flex items-center gap-3 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      <div ref={resultsRef} className="space-y-6 mt-8">
        {analysis && urgency && (
          <div className={`copilot-fade-up rounded-2xl border px-5 py-4 ${urgency.banner}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">{urgency.label}</span>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${urgency.badge}`}>
                Urgency score {Math.round((analysis.urgency_score || 0) * 100)}%
              </span>
            </div>
            <p className="mt-2 text-sm opacity-90">{analysis.urgency_justification}</p>
          </div>
        )}

        {analysis && (
          <div className="copilot-fade-up grid sm:grid-cols-2 gap-4" style={{ animationDelay: '0.1s' }}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Stethoscope className="w-4 h-4 text-teal-500" />
                Recommended specialty
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {analysis.primary_specialty}
              </p>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Confidence</span>
                  <span>{Math.round((analysis.primary_confidence || 0) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500 transition-all duration-1000"
                    style={{ width: `${Math.round((analysis.primary_confidence || 0) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Key symptoms identified</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(analysis.key_symptoms || []).map((symptom, i) => (
                  <span
                    key={i}
                    className="copilot-fade-up text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    style={{ animationDelay: `${0.1 * i}s` }}
                  >
                    {symptom}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {doctors.length > 0 && (
          <div className="copilot-fade-up">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Doctors found by the Research Agent
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doc, i) => (
                <div
                  key={i}
                  className="copilot-fade-up bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                  style={{ animationDelay: `${0.08 * i}s` }}
                >
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">
                    {doc.name || doc.full_name || 'Doctor'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {doc.designation || doc.specialty || doc.specialization || ''}
                  </p>
                  {(doc.location || doc.city) && (
                    <p className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                      <MapPin className="w-3 h-3" /> {doc.location || doc.city}
                    </p>
                  )}
                  {(doc.mobile || doc.phone) && (
                    <p className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 mt-1">
                      <Phone className="w-3 h-3" /> {doc.mobile || doc.phone}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report && (
          <div className="copilot-fade-up bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-teal-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Your health summary</p>
            </div>
            <ReportMarkdown text={report} />
          </div>
        )}

        {(analysis || report) && (
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 pb-6">
            AyuMitraAI provides routing guidance only and is not a substitute for professional medical advice.
          </p>
        )}
      </div>
    </div>
  );
};

export default HealthCopilot;
