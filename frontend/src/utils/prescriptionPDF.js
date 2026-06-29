import { jsPDF } from 'jspdf';

/**
 * Generates a clinical prescription PDF and triggers browser download.
 *
 * @param {Object} data
 * @param {string} data.patientName
 * @param {string} data.patientAge
 * @param {string} data.doctorName
 * @param {string} data.doctorSpecialty
 * @param {string} data.symptoms
 * @param {string} data.notes
 * @param {Array}  data.medications  — [{ name, dosage, frequency, duration }]
 * @param {string} data.date         — ISO date string
 * @param {string} data.prescriptionId
 */
export function generatePrescriptionPDF(data) {
  const {
    patientName = 'Unknown',
    patientAge = '',
    doctorName = 'Unknown',
    doctorSpecialty = '',
    symptoms = '',
    notes = '',
    medications = [],
    date = new Date().toISOString(),
    prescriptionId = '',
  } = data;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Header gradient bar ──────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);         // slate-900
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setFillColor(99, 102, 241);       // indigo-500
  doc.rect(0, 25, pageW, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('AyuMitraAI', margin, 17);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 230);
  doc.text('AI-Powered Healthcare Platform', margin, 23);

  const dateStr = new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  doc.text(dateStr, pageW - margin, 17, { align: 'right' });
  if (prescriptionId) {
    doc.text(`Rx ID: ${prescriptionId.substring(0, 8).toUpperCase()}`, pageW - margin, 23, { align: 'right' });
  }

  y = 36;

  // ── Section helper ───────────────────────────────────────────────────────
  const section = (label) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(99, 102, 241);   // indigo
    doc.text(label.toUpperCase(), margin, y);
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.4);
    doc.line(margin + doc.getTextWidth(label.toUpperCase()) + 2, y - 0.5, pageW - margin, y - 0.5);
    y += 5;
  };

  const field = (label, value, indentLabel = margin, indentValue = margin + 32) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);  // slate-400
    doc.text(`${label}:`, indentLabel, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(value || '—', contentW - 34);
    doc.text(lines, indentValue, y);
    y += lines.length * 5 + 1;
  };

  // ── Patient info ─────────────────────────────────────────────────────────
  section('Patient Information');
  field('Name', patientName);
  field('Age', patientAge ? `${patientAge} years` : '—');
  y += 3;

  // ── Doctor info ──────────────────────────────────────────────────────────
  section('Prescribing Doctor');
  field('Doctor', `Dr. ${doctorName}`);
  field('Specialty', doctorSpecialty);
  y += 3;

  // ── Symptoms ─────────────────────────────────────────────────────────────
  section('Presenting Symptoms');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const symptomLines = doc.splitTextToSize(symptoms || '—', contentW);
  doc.text(symptomLines, margin, y);
  y += symptomLines.length * 5 + 4;

  // ── Medications table ────────────────────────────────────────────────────
  section('Prescribed Medications');
  if (medications.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No medications prescribed.', margin, y);
    y += 6;
  } else {
    // Table header
    const cols = { name: margin, dose: margin + 60, freq: margin + 95, dur: margin + 130 };
    doc.setFillColor(241, 245, 249);   // slate-100
    doc.rect(margin, y - 3, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('Medication', cols.name, y + 1);
    doc.text('Dosage', cols.dose, y + 1);
    doc.text('Frequency', cols.freq, y + 1);
    doc.text('Duration', cols.dur, y + 1);
    y += 7;

    medications.forEach((med, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 3, contentW, 7, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(med.name || '—', cols.name, y + 1);
      doc.text(med.dosage || '—', cols.dose, y + 1);
      doc.text(med.frequency || '—', cols.freq, y + 1);
      doc.text(med.duration || '—', cols.dur, y + 1);
      y += 7;
    });
  }
  y += 3;

  // ── Doctor notes ─────────────────────────────────────────────────────────
  section('Doctor Notes');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const noteLines = doc.splitTextToSize(notes || 'No additional notes.', contentW);
  doc.text(noteLines, margin, y);
  y += noteLines.length * 5 + 6;

  // ── Signature ────────────────────────────────────────────────────────────
  const sigX = pageW - margin - 55;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(sigX, y, pageW - margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Dr. ${doctorName}`, sigX, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(doctorSpecialty, sigX, y + 8);

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.setFillColor(241, 245, 249);
  doc.rect(0, pageH - 14, pageW, 14, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This prescription was generated by AyuMitraAI. For emergencies, call 112.',
    pageW / 2, pageH - 7, { align: 'center' }
  );
  doc.text(
    'AyuMitraAI is an AI-assisted platform. Always consult a licensed physician.',
    pageW / 2, pageH - 3, { align: 'center' }
  );

  doc.save(`AyuMitra_Prescription_${prescriptionId?.substring(0, 8) || 'rx'}.pdf`);
  return doc;
}
