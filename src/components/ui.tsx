import React from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  PauseCircle,
  Send,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md';
  }
> = ({ variant = 'primary', size = 'md', className = '', children, ...rest }) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-xs min-h-[34px]' : 'px-4 py-2 text-sm min-h-[40px]';
  const variants = {
    primary: 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]',
    secondary: 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE] hover:bg-[#DBEAFE]',
    outline: 'bg-white text-[#0F295C] border border-[#BFDBFE] hover:bg-[#EFF6FF]',
    ghost: 'bg-transparent text-[#1E40AF] hover:bg-[#EFF6FF]',
  };
  return (
    <button className={`${base} ${sizing} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`bg-white border border-[#DBEAFE] rounded-xl ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#DBEAFE]">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#0A1936] text-balance">{title}</h1>
      {subtitle && <p className="text-sm text-[#3B5998] mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
  </div>
);

/**
 * Pure blue-and-white status indicator with mandatory icon + text label.
 */
export const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  const s = status.toLowerCase();
  let Icon = FileText;
  let style = 'bg-white text-[#1E40AF] border-[#BFDBFE]';

  if (['won', 'accepted', 'paid', 'active', 'qualified', 'completed', 'approved', 'valid'].includes(s)) {
    Icon = CheckCircle2;
    style = 'bg-[#EFF6FF] text-[#0F295C] border-[#93C5FD] font-semibold';
  } else if (['overdue', 'critical', 'do not contact'].includes(s)) {
    Icon = AlertCircle;
    style = 'bg-[#0F295C] text-white border-[#0F295C] font-semibold';
  } else if (['sent', 'issued', 'partially paid', 'demo scheduled', 'proposal', 'negotiation', 'engaged'].includes(s)) {
    Icon = s === 'sent' ? Send : Clock;
    style = 'bg-[#1D4ED8] text-white border-[#1D4ED8] font-medium';
  } else if (['on hold', 'pending', 'approached', 'discovery', 'awaiting response'].includes(s)) {
    Icon = PauseCircle;
    style = 'bg-[#DBEAFE] text-[#0F295C] border-[#93C5FD]';
  } else if (['lost', 'declined', 'void', 'cancelled', 'reversed', 'expired', 'dismissed', 'inactive'].includes(s)) {
    Icon = s === 'void' || s === 'cancelled' ? Ban : XCircle;
    style = 'bg-[#F4F8FF] text-[#4B6B9B] border-[#DBEAFE]';
  } else if (['locked'].includes(s)) {
    Icon = Lock;
    style = 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-xs whitespace-nowrap shrink-0 ${style}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};

export const ErrorAlert: React.FC<{ message: string; onClose?: () => void }> = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-[#0F295C] text-white text-sm"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss error" className="text-white/80 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const SuccessBanner: React.FC<{ message: string; onClose?: () => void }> = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-[#EFF6FF] border border-[#93C5FD] text-[#0F295C] text-sm"
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#1D4ED8]" />
        <span>{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss message" className="text-[#3B5998] hover:text-[#0F295C]">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const InfoBanner: React.FC<{ title: string; body: string; action?: React.ReactNode }> = ({
  title,
  body,
  action,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-[#F4F8FF] border border-[#BFDBFE] text-sm">
    <div className="flex items-start gap-2.5">
      <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-[#1D4ED8]" />
      <div>
        <div className="font-medium text-[#0F295C]">{title}</div>
        <div className="text-[#3B5998] text-xs mt-0.5">{body}</div>
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="p-10 text-center bg-white border border-[#DBEAFE] rounded-xl">
    <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] flex items-center justify-center mx-auto mb-3">
      <FileText className="w-5 h-5" />
    </div>
    <h3 className="text-base font-semibold text-[#0A1936]">{title}</h3>
    <p className="text-sm text-[#3B5998] mt-1 max-w-md mx-auto">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ open, onClose, title, subtitle, children, maxWidth = 'max-w-xl' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A1936]/40 backdrop-blur-[1px] overflow-y-auto no-print">
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${maxWidth} bg-white border border-[#BFDBFE] rounded-xl shadow-lg my-8 max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#DBEAFE]">
          <div>
            <h2 className="text-lg font-semibold text-[#0A1936]">{title}</h2>
            {subtitle && <p className="text-xs text-[#3B5998] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#3B5998] hover:bg-[#EFF6FF] hover:text-[#0F295C]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-[#0F295C] mb-1">
      {label}
      {required && <span className="text-[#1D4ED8] ml-0.5">*</span>}
    </span>
    {children}
    {hint && <span className="block text-xs text-[#3B5998] mt-1">{hint}</span>}
  </label>
);

export const inputCls =
  'w-full px-3 py-2 text-sm bg-white border border-[#BFDBFE] rounded-lg text-[#0A1936] placeholder-[#7C98C4] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:border-[#1D4ED8]';

export const selectCls =
  'w-full px-3 py-2 text-sm bg-white border border-[#BFDBFE] rounded-lg text-[#0A1936] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:border-[#1D4ED8]';
