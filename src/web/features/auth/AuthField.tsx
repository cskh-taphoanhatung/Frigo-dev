import React, { useId } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';

interface AuthFieldProps {
  label: string;
  icon: LucideIcon;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  autoComplete?: string;
  /** Optional password reveal toggle rendered inside the field. */
  reveal?: { show: boolean; onToggle: () => void };
}

/** Shared auth input field (screen 02: real labels, 44px targets, focus ring). */
export const AuthField: React.FC<AuthFieldProps> = ({
  label,
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  required = true,
  autoComplete,
  reveal,
}) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <Icon className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
        <input
          id={id}
          type={reveal?.show ? 'text' : type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete ?? (type === 'email' ? 'email' : type === 'password' ? 'current-password' : 'name')}
          className={`w-full h-11 pl-10 bg-white border border-slate-200/80 focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-slate-900 shadow-xs ${reveal ? 'pr-10' : 'pr-4'}`}
        />
        {reveal && (
          <button
            type="button"
            onClick={reveal.onToggle}
            aria-label={reveal.show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={reveal.show}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 tap-target"
          >
            {reveal.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
};
