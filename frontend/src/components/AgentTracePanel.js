import React, { useState, useEffect, useRef } from 'react';

/**
 * AgentTracePanel
 *
 * Consumes the SSE stream from POST /api/connect-with-doctor/stream
 * and renders a live, animated agent reasoning trace for demo purposes.
 *
 * Props:
 *   symptoms     {string}   - patient symptom description
 *   patientAge   {number}   - patient age (optional)
 *   patientName  {string}   - patient name (optional)
 *   onComplete   {function} - called with { request_id, matching_doctors, primary_specialty, urgency_level, urgency_score }
 *   onError      {function} - called with error message
 *   backendUrl   {string}   - base API URL
 */
const AgentTracePanel = ({ symptoms, patientAge, patientName, onComplete, onError, backendUrl }) => {
  const [steps, setSteps] = useState([]);
  const [isDone, setIsDone] = useState(false);
  const [isError, setIsError] = useState(false);
  const bottomRef = useRef(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startStream();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  const addStep = (step) => {
    setSteps(prev => [...prev, step]);
  };

  const startStream = async () => {
    try {
      const token = localStorage.getItem('ayumitra-token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/connect-with-doctor/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          symptom_description: symptoms,
          patient_age: patientAge ? parseInt(patientAge) : null,
          patient_name: patientName || null,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // keep incomplete chunk

        for (const chunk of lines) {
          const line = chunk.replace(/^data:\s*/, '').trim();
          if (!line) continue;
          try {
            const event = JSON.parse(line);
            handleEvent(event);
          } catch (_) { /* ignore malformed */ }
        }
      }
    } catch (err) {
      setIsError(true);
      addStep({ type: 'error', message: err.message || 'Stream failed' });
      onError?.(err.message);
    }
  };

  const handleEvent = (event) => {
    switch (event.event) {
      case 'agent_start':
        addStep({ type: 'think', agent: event.agent, step: event.step, text: event.thinking });
        break;
      case 'tool_call':
        addStep({ type: 'tool_call', tool: event.tool, step: event.step, input: event.input });
        break;
      case 'tool_result':
        addStep({ type: 'tool_result', tool: event.tool, step: event.step, output: event.output });
        break;
      case 'llm_response':
        addStep({
          type: 'llm',
          agent: event.agent,
          step: event.step,
          specialty: event.specialty,
          urgency: event.urgency,
          urgency_score: event.urgency_score,
          justification: event.justification,
        });
        break;
      case 'done':
        setIsDone(true);
        addStep({ type: 'done', step: event.step, count: event.matching_doctors?.length });
        setTimeout(() => {
          onComplete?.({
            request_id: event.request_id,
            matching_doctors: event.matching_doctors,
            primary_specialty: event.primary_specialty,
            urgency_level: event.urgency_level,
            urgency_score: event.urgency_score,
          });
        }, 1200);
        break;
      default:
        break;
    }
  };

  const agentColor = (agent) => {
    const map = {
      TriageAgent: '#818cf8',
      SymptomAnalyzerAgent: '#a78bfa',
      RoutingAgent: '#34d399',
      MatchingAgent: '#60a5fa',
    };
    return map[agent] || '#94a3b8';
  };

  const urgencyColor = (level) => {
    if (!level) return '#94a3b8';
    const l = level.toLowerCase();
    if (l.includes('critical')) return '#f87171';
    if (l.includes('high') || l.includes('severe')) return '#fb923c';
    if (l.includes('moderate')) return '#fbbf24';
    return '#4ade80';
  };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.liveIndicator}>
            <div style={styles.liveDot} />
            <span style={styles.liveText}>LIVE</span>
          </div>
          <span style={styles.headerTitle}>Multi-Agent Reasoning Trace</span>
        </div>
        <div style={styles.headerRight}>
          {!isDone && !isError && <span style={styles.spinnerText}>Processing...</span>}
          {isDone && <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>✓ Complete</span>}
          {isError && <span style={{ color: '#f87171', fontSize: '12px' }}>✗ Error</span>}
        </div>
      </div>

      {/* Symptom pill */}
      <div style={styles.symptomPill}>
        <span style={styles.symptomLabel}>Patient Query</span>
        <span style={styles.symptomText}>"{symptoms}"</span>
      </div>

      {/* Steps */}
      <div style={styles.stepsList}>
        {steps.map((step, idx) => (
          <StepItem key={idx} step={step} agentColor={agentColor} urgencyColor={urgencyColor} isLast={idx === steps.length - 1 && !isDone} />
        ))}
        {!isDone && !isError && steps.length === 0 && (
          <div style={styles.initializing}>
            <div style={styles.spinner} />
            <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: 10 }}>Initializing agents...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};


// ── Individual step renderer ────────────────────────────────────────────────
const StepItem = ({ step, agentColor, urgencyColor, isLast }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);
  const [expanded, setExpanded] = useState(false);

  if (step.type === 'think') {
    return (
      <div style={{ ...styles.stepRow, opacity: visible ? 1 : 0, transition: 'opacity 0.4s' }}>
        <div style={{ ...styles.agentBadge, background: agentColor(step.agent) + '22', borderColor: agentColor(step.agent) }}>
          <span style={{ ...styles.agentDot, background: agentColor(step.agent) }} />
          <span style={{ color: agentColor(step.agent), fontSize: 11, fontWeight: 700 }}>{step.agent}</span>
        </div>
        <div style={styles.thinkBubble}>
          <span style={styles.thinkText}>{step.text}</span>
          {isLast && <span style={styles.cursor}>|</span>}
        </div>
      </div>
    );
  }

  if (step.type === 'tool_call') {
    return (
      <div style={{ ...styles.stepRow, opacity: visible ? 1 : 0, transition: 'opacity 0.4s' }}>
        <div style={styles.toolCallBadge}>
          <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>TOOL CALL</span>
          <code style={styles.toolName}>{step.tool}</code>
        </div>
        <div style={styles.toolInput}>
          <span style={{ color: '#94a3b8', fontSize: 10, marginRight: 6 }}>INPUT:</span>
          <code style={styles.codeInline}>
            {typeof step.input === 'string' ? step.input : JSON.stringify(step.input)}
          </code>
        </div>
      </div>
    );
  }

  if (step.type === 'tool_result') {
    const json = JSON.stringify(step.output, null, 2);
    const preview = json.substring(0, 120) + (json.length > 120 ? '...' : '');
    return (
      <div style={{ ...styles.stepRow, opacity: visible ? 1 : 0, transition: 'opacity 0.4s' }}>
        <div style={styles.toolResultBadge}>
          <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }}>TOOL RESULT</span>
          <code style={{ ...styles.toolName, color: '#34d399' }}>{step.tool}</code>
        </div>
        <div style={styles.toolOutput}>
          <pre style={styles.pre}>{expanded ? json : preview}</pre>
          {json.length > 120 && (
            <button style={styles.expandBtn} onClick={() => setExpanded(e => !e)}>
              {expanded ? '▲ collapse' : '▼ expand'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step.type === 'llm') {
    return (
      <div style={{ ...styles.stepRow, opacity: visible ? 1 : 0, transition: 'opacity 0.4s' }}>
        <div style={{ ...styles.agentBadge, background: '#8b5cf622', borderColor: '#8b5cf6' }}>
          <span style={{ ...styles.agentDot, background: '#8b5cf6' }} />
          <span style={{ color: '#8b5cf6', fontSize: 11, fontWeight: 700 }}>Gemini LLM</span>
        </div>
        <div style={styles.llmResult}>
          <div style={styles.llmRow}>
            <span style={styles.llmLabel}>Specialty:</span>
            <span style={styles.llmValue}>{step.specialty}</span>
          </div>
          <div style={styles.llmRow}>
            <span style={styles.llmLabel}>Urgency:</span>
            <span style={{ ...styles.llmValue, color: urgencyColor(step.urgency), fontWeight: 700 }}>
              {step.urgency} ({Math.round((step.urgency_score || 0) * 100)}%)
            </span>
          </div>
          <div style={{ ...styles.llmRow, alignItems: 'flex-start' }}>
            <span style={styles.llmLabel}>Reasoning:</span>
            <span style={{ ...styles.llmValue, color: '#94a3b8', fontSize: 11 }}>{step.justification}</span>
          </div>
        </div>
      </div>
    );
  }

  if (step.type === 'done') {
    return (
      <div style={{ ...styles.doneRow, opacity: visible ? 1 : 0, transition: 'opacity 0.5s' }}>
        <span style={{ color: '#4ade80', fontSize: 20 }}>✓</span>
        <div>
          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>Pipeline Complete</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
            Matched {step.count} doctor{step.count !== 1 ? 's' : ''}. Transitioning to results...
          </div>
        </div>
      </div>
    );
  }

  if (step.type === 'error') {
    return (
      <div style={{ ...styles.doneRow, borderColor: '#ef4444', background: '#ef444411' }}>
        <span style={{ color: '#ef4444', fontSize: 20 }}>✗</span>
        <div>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>Agent Error</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>{step.message}</div>
        </div>
      </div>
    );
  }

  return null;
};


// ── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  panel: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    borderRadius: 16,
    border: '1px solid #1e293b',
    overflow: 'hidden',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: 'rgba(15,23,42,0.8)',
    borderBottom: '1px solid #1e293b',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerRight: { display: 'flex', alignItems: 'center' },
  liveIndicator: { display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#ef444422', borderRadius: 20, border: '1px solid #ef4444' },
  liveDot: {
    width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
    animation: 'pulse 1.2s infinite',
  },
  liveText: { color: '#f87171', fontSize: 9, fontWeight: 700, letterSpacing: 1 },
  headerTitle: { color: '#e2e8f0', fontSize: 12, fontWeight: 600 },
  spinnerText: { color: '#94a3b8', fontSize: 11 },
  symptomPill: {
    margin: '12px 20px',
    background: '#1e293b',
    borderRadius: 10,
    padding: '8px 14px',
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    border: '1px solid #334155',
  },
  symptomLabel: { color: '#64748b', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' },
  symptomText: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic' },
  stepsList: { padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 440, overflowY: 'auto' },
  stepRow: { display: 'flex', flexDirection: 'column', gap: 4 },
  agentBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, border: '1px solid', width: 'fit-content' },
  agentDot: { width: 6, height: 6, borderRadius: '50%' },
  thinkBubble: { background: '#1e293b', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #818cf8', marginTop: 2, display: 'flex', alignItems: 'flex-start', gap: 6 },
  thinkIcon: { fontSize: 13, marginTop: 1 },
  thinkText: { color: '#cbd5e1', fontSize: 11.5, lineHeight: 1.6 },
  cursor: { color: '#818cf8', animation: 'blink 1s step-end infinite', fontSize: 13, marginLeft: 2 },
  toolCallBadge: { display: 'flex', alignItems: 'center', padding: '3px 10px', background: '#f59e0b11', border: '1px solid #f59e0b44', borderRadius: 8, width: 'fit-content', gap: 3 },
  toolName: { background: '#0f172a', color: '#fbbf24', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, marginLeft: 6 },
  toolInput: { background: '#1e293b', borderRadius: 8, padding: '6px 12px', marginTop: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  codeInline: { color: '#f0abfc', fontSize: 10.5, background: '#0f172a', padding: '2px 6px', borderRadius: 4 },
  toolResultBadge: { display: 'flex', alignItems: 'center', padding: '3px 10px', background: '#34d39911', border: '1px solid #34d39944', borderRadius: 8, width: 'fit-content', gap: 3 },
  toolOutput: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '6px 12px', marginTop: 2 },
  pre: { color: '#94a3b8', fontSize: 9.5, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 },
  expandBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 10, marginTop: 4, padding: 0 },
  llmResult: { background: '#1e293b', borderRadius: 8, padding: '8px 12px', marginTop: 2, display: 'flex', flexDirection: 'column', gap: 4, borderLeft: '3px solid #8b5cf6' },
  llmRow: { display: 'flex', gap: 8, alignItems: 'center' },
  llmLabel: { color: '#64748b', fontSize: 10, fontWeight: 700, minWidth: 64 },
  llmValue: { color: '#e2e8f0', fontSize: 11 },
  doneRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#4ade8011', border: '1px solid #4ade8044', borderRadius: 10, marginTop: 4 },
  initializing: { display: 'flex', alignItems: 'center', padding: '16px 0' },
  spinner: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid #334155', borderTopColor: '#818cf8',
    animation: 'spin 0.8s linear infinite',
  },
};

// Inject keyframes
if (typeof document !== 'undefined' && !document.getElementById('agent-trace-keyframes')) {
  const style = document.createElement('style');
  style.id = 'agent-trace-keyframes';
  style.textContent = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes spin { to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(style);
}

export default AgentTracePanel;
