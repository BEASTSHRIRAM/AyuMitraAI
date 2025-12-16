import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

const UrgencyBadge = ({ level, score }) => {
  const configs = {
    critical: {
      bg: 'bg-red-100 dark:bg-red-950/30',
      border: 'border-red-500 dark:border-red-500',
      text: 'text-red-900 dark:text-red-300',
      icon: AlertCircle,
      label: 'Critical Urgency'
    },
    moderate: {
      bg: 'bg-amber-100 dark:bg-amber-950/30',
      border: 'border-amber-500 dark:border-amber-500',
      text: 'text-amber-900 dark:text-amber-300',
      icon: AlertTriangle,
      label: 'Moderate Urgency'
    },
    mild: {
      bg: 'bg-emerald-100 dark:bg-emerald-950/30',
      border: 'border-emerald-500 dark:border-emerald-500',
      text: 'text-emerald-900 dark:text-emerald-300',
      icon: CheckCircle,
      label: 'Mild Urgency'
    }
  };

  const config = configs[level] || configs.mild;
  const Icon = config.icon;

  return (
    <div data-testid={`urgency-badge-${level}`} className={`flex items-center gap-3 p-4 rounded-xl border-2 ${config.bg} ${config.border} transition-colors duration-500`}>
      <Icon className="w-6 h-6" />
      <div className="flex-1">
        <h3 className={`font-bold text-lg ${config.text}`}>{config.label}</h3>
        <p className={`text-sm ${config.text} opacity-80`}>Confidence: {(score * 100).toFixed(1)}%</p>
      </div>
    </div>
  );
};

export default UrgencyBadge;