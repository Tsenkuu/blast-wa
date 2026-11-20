import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  badge?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'blue',
  badge,
  onClick
}) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      iconBg: 'bg-brand-600 text-white',
      border: 'border-blue-100 dark:border-blue-900/50',
      text: 'text-brand-600 dark:text-brand-400'
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconBg: 'bg-emerald-600 text-white',
      border: 'border-emerald-100 dark:border-emerald-900/50',
      text: 'text-emerald-600 dark:text-emerald-400'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      iconBg: 'bg-amber-600 text-white',
      border: 'border-amber-100 dark:border-amber-900/50',
      text: 'text-amber-600 dark:text-amber-400'
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      iconBg: 'bg-rose-600 text-white',
      border: 'border-rose-100 dark:border-rose-900/50',
      text: 'text-rose-600 dark:text-rose-400'
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      iconBg: 'bg-indigo-600 text-white',
      border: 'border-indigo-100 dark:border-indigo-900/50',
      text: 'text-indigo-600 dark:text-indigo-400'
    },
    slate: {
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      iconBg: 'bg-slate-700 text-white',
      border: 'border-slate-200 dark:border-slate-800',
      text: 'text-slate-700 dark:text-slate-300'
    }
  };

  const scheme = colorMap[color];

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-brand-300 dark:hover:border-brand-700' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${scheme.iconBg}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-baseline space-x-2">
        <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {value}
        </span>
        {badge && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {badge}
          </span>
        )}
      </div>
      {subtext && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          {subtext}
        </p>
      )}
    </div>
  );
};
