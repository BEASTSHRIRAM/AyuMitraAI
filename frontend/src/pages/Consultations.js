import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { generatePrescriptionPDF } from '../utils/prescriptionPDF';
import { toast } from 'sonner';
import { FileText, Download, Stethoscope, Calendar, ChevronDown, ChevronRight, Loader2, Clock, Activity } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const urgencyColor = (level) => {
  if (!level) return { bg: '#1e293b', text: '#94a3b8', border: '#334155' };
  const l = level.toLowerCase();
  if (l.includes('critical')) return { bg: '#450a0a', text: '#f87171', border: '#991b1b' };
  if (l.includes('high') || l.includes('severe')) return { bg: '#431407', text: '#fb923c', border: '#9a3412' };
  if (l.includes('moderate')) return { bg: '#422006', text: '#fbbf24', border: '#92400e' };
  return { bg: '#052e16', text: '#4ade80', border: '#166534' };
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Consultations() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [ragContext, setRagContext] = useState({});
  const [loadingRag, setLoadingRag] = useState({});

  const token = localStorage.getItem('ayumitra-token');

  useEffect(() => {
    if (!token) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rxRes, histRes] = await Promise.allSettled([
        api.get('/patient/prescriptions'),
        api.get('/patient/history'),
      ]);
      if (rxRes.status === 'fulfilled') setPrescriptions(rxRes.value.data.prescriptions || []);
      if (histRes.status === 'fulfilled') setHistory(histRes.value.data || []);
    } catch (err) {
      toast.error('Failed to load consultations');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const fetchRagContext = async (prescription) => {
    const key = prescription.prescription_id;
    if (ragContext[key] || loadingRag[key]) return;
    setLoadingRag(r => ({ ...r, [key]: true }));
    try {
      const res = await api.get('/patient/similar-prescriptions', { params: { query: prescription.symptoms } });
      setRagContext(r => ({ ...r, [key]: res.data.similar_prescriptions || [] }));
    } catch {
      setRagContext(r => ({ ...r, [key]: [] }));
    } finally {
      setLoadingRag(r => ({ ...r, [key]: false }));
    }
  };

  const downloadPdf = (rx) => {
    generatePrescriptionPDF({
      patientName: rx.patient_name,
      patientAge: '',
      doctorName: rx.doctor_name,
      doctorSpecialty: rx.doctor_specialty,
      symptoms: rx.symptoms,
      notes: rx.notes,
      medications: rx.medications || [],
      date: rx.created_at,
      prescriptionId: rx.prescription_id,
    });
    toast.success('PDF downloaded!');
  };

  if (!token) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.emptyState}>
            <h2 style={{ color: '#e2e8f0', marginTop: 16 }}>Please log in</h2>
            <p style={{ color: '#94a3b8', marginTop: 8 }}>You need to be logged in to view your consultations.</p>
            <button
              onClick={() => window.location.href = '/login'}
              style={styles.primaryBtn}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.pageHeader}>
          <div style={styles.pageHeaderIcon}><FileText size={24} color="#818cf8" /></div>
          <div>
            <h1 style={styles.pageTitle}>My Consultations</h1>
            <p style={styles.pageSubtitle}>
              Your past prescriptions with RAG-powered context for smarter future sessions
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <span style={styles.statNum}>{prescriptions.length}</span>
            <span style={styles.statLabel}>Prescriptions</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statNum}>{history.length}</span>
            <span style={styles.statLabel}>Consultations</span>
          </div>
          <div style={{ ...styles.statCard, borderColor: '#6366f133' }}>
            <span style={styles.statNum}>RAG</span>
            <span style={styles.statLabel}>Enabled</span>
          </div>
        </div>

        {loading && (
          <div style={styles.emptyState}>
            <Loader2 size={32} color="#818cf8" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#94a3b8', marginTop: 12 }}>Loading your health records...</p>
          </div>
        )}

        {/* Prescriptions Section */}
        {!loading && (
          <>
            <h2 style={styles.sectionTitle}><Stethoscope size={16} /> Prescriptions</h2>
            {prescriptions.length === 0 ? (
              <div style={styles.emptyCard}>
                <p style={{ color: '#64748b' }}>No prescriptions yet. Generate one after your next consultation.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {prescriptions.map(rx => {
                  const uc = urgencyColor('moderate');
                  const isOpen = expanded[rx.prescription_id];
                  return (
                    <div key={rx.prescription_id} style={styles.card}>
                      {/* Card Header */}
                      <div
                        style={styles.cardHeader}
                        onClick={() => {
                          toggleExpand(rx.prescription_id);
                          if (!expanded[rx.prescription_id]) fetchRagContext(rx);
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={styles.doctorName}>Dr. {rx.doctor_name}</span>
                            <span style={styles.specialtyBadge}>{rx.doctor_specialty}</span>
                          </div>
                          <div style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={10} /> {formatDate(rx.created_at)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={e => { e.stopPropagation(); downloadPdf(rx); }}
                            style={styles.downloadBtn}
                            title="Download PDF"
                          >
                            <Download size={14} />
                          </button>
                          {isOpen ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isOpen && (
                        <div style={styles.cardBody}>
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Symptoms</span>
                            <span style={styles.detailValue}>{rx.symptoms || '—'}</span>
                          </div>
                          <div style={styles.detailRow}>
                            <span style={styles.detailLabel}>Notes</span>
                            <span style={styles.detailValue}>{rx.notes || '—'}</span>
                          </div>
                          {rx.medications?.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <span style={styles.detailLabel}>Medications</span>
                              <div style={styles.medsTable}>
                                <div style={styles.medsHeader}>
                                  {['Name', 'Dosage', 'Frequency', 'Duration'].map(h => (
                                    <span key={h} style={styles.medsHeaderCell}>{h}</span>
                                  ))}
                                </div>
                                {rx.medications.map((m, i) => (
                                  <div key={i} style={{ ...styles.medsRow, background: i % 2 === 0 ? '#1e293b' : '#0f172a' }}>
                                    <span style={styles.medsCell}>{m.name}</span>
                                    <span style={styles.medsCell}>{m.dosage}</span>
                                    <span style={styles.medsCell}>{m.frequency}</span>
                                    <span style={styles.medsCell}>{m.duration}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* RAG Context Section */}
                          <div style={styles.ragSection}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <Activity size={13} color="#818cf8" />
                              <span style={{ color: '#818cf8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                RAG Context — Similar Past Prescriptions
                              </span>
                              {loadingRag[rx.prescription_id] && <Loader2 size={11} color="#818cf8" style={{ animation: 'spin 1s linear infinite' }} />}
                            </div>
                            {ragContext[rx.prescription_id]?.length === 0 && (
                              <p style={{ color: '#64748b', fontSize: 11 }}>
                                No similar prescriptions found in vector store (requires Qdrant cluster).
                              </p>
                            )}
                            {ragContext[rx.prescription_id]?.map((sr, i) => (
                              <div key={i} style={styles.ragCard}>
                                <div style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 600 }}>
                                  Dr. {sr.doctor_name} — {sr.specialty}
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: 10.5, marginTop: 3 }}>
                                  Symptoms: {sr.symptoms?.substring(0, 100)}
                                </div>
                                {sr.medications?.length > 0 && (
                                  <div style={{ color: '#64748b', fontSize: 10.5, marginTop: 2 }}>
                                    Rx: {sr.medications.map(m => m.name).join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Consultation History */}
            <h2 style={{ ...styles.sectionTitle, marginTop: 32 }}><Calendar size={16} /> Consultation History</h2>
            {history.length === 0 ? (
              <div style={styles.emptyCard}>
                <p style={{ color: '#64748b' }}>No consultation history yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map((h, i) => {
                  const uc = urgencyColor(h.urgency_level);
                  return (
                    <div key={i} style={styles.histCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600 }}>
                            {h.doctor_name ? `Dr. ${h.doctor_name}` : 'No doctor assigned'}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{formatDate(h.requested_at)}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 5, maxWidth: 320 }}>
                            {h.symptoms?.substring(0, 120)}{h.symptoms?.length > 120 ? '...' : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                          <span style={{ ...styles.statusBadge, background: h.status === 'completed' ? '#052e16' : '#1e293b', color: h.status === 'completed' ? '#4ade80' : '#94a3b8', border: `1px solid ${h.status === 'completed' ? '#166534' : '#334155'}` }}>
                            {h.status}
                          </span>
                          {h.urgency_level && (
                            <span style={{ ...styles.statusBadge, background: uc.bg, color: uc.text, border: `1px solid ${uc.border}` }}>
                              {h.urgency_level}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: 720, margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  pageHeaderIcon: { width: 48, height: 48, background: '#6366f122', border: '1px solid #6366f144', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: '#e2e8f0', fontSize: 22, fontWeight: 700, margin: 0 },
  pageSubtitle: { color: '#64748b', fontSize: 12.5, marginTop: 3, margin: 0 },
  statsRow: { display: 'flex', gap: 12, marginBottom: 28 },
  statCard: { flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 16px', textAlign: 'center' },
  statNum: { display: 'block', color: '#e2e8f0', fontSize: 22, fontWeight: 700 },
  statLabel: { display: 'block', color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  sectionTitle: { color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' },
  emptyCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 24, textAlign: 'center' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', transition: 'background 0.2s' },
  cardBody: { padding: '0 16px 16px', borderTop: '1px solid #0f172a' },
  doctorName: { color: '#e2e8f0', fontSize: 13.5, fontWeight: 600 },
  specialtyBadge: { background: '#6366f122', border: '1px solid #6366f133', color: '#a5b4fc', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600 },
  downloadBtn: { background: '#1e3a5f', border: '1px solid #1e40af', borderRadius: 7, padding: '5px 8px', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  detailRow: { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  detailLabel: { color: '#64748b', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, minWidth: 70 },
  detailValue: { color: '#cbd5e1', fontSize: 11.5, flex: 1 },
  medsTable: { marginTop: 6, border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' },
  medsHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#0f172a', padding: '6px 10px', gap: 8 },
  medsHeaderCell: { color: '#475569', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 },
  medsRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '6px 10px', gap: 8 },
  medsCell: { color: '#cbd5e1', fontSize: 11 },
  ragSection: { marginTop: 16, padding: 12, background: '#0f172a', border: '1px solid #6366f133', borderRadius: 10 },
  ragCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', marginTop: 6 },
  histCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 14px' },
  statusBadge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' },
  primaryBtn: { background: '#6366f1', border: 'none', color: 'white', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 16 },
};
