import React from 'react';
import { motion } from 'motion/react';
import { CountUp } from './motion';

export const CHART_COLORS = [
  '#1D4ED8',
  '#3B82F6',
  '#60A5FA',
  '#93C5FD',
  '#BFDBFE',
  '#DBEAFE',
  '#0F295C',
];

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

export const DonutChart: React.FC<{
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}> = ({ data, size = 180, thickness = 24, centerLabel, centerValue }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#EFF6FF"
            strokeWidth={thickness}
          />
          {total > 0 &&
            data.map((d, i) => {
              const frac = d.value / total;
              const len = frac * circumference;
              const el = (
                <motion.circle
                  key={d.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={d.color || CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${circumference - len}`}
                  initial={{ strokeDashoffset: circumference, opacity: 0 }}
                  animate={{ strokeDashoffset: -offset, opacity: 1 }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue && (
              <span className="text-lg font-semibold text-[#0A1936] tabular-nums">{centerValue}</span>
            )}
            {centerLabel && <span className="text-[11px] text-[#3B5998]">{centerLabel}</span>}
          </div>
        )}
      </div>
      <ul className="space-y-1.5 min-w-0">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: d.color || CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-[#0F295C] truncate">{d.label}</span>
            <span className="ml-auto font-semibold text-[#0A1936] tabular-nums pl-3">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export interface AreaPoint {
  label: string;
  value: number;
}

/** Minimal animated area/line chart rendered as SVG. */
export const AreaChart: React.FC<{
  data: AreaPoint[];
  height?: number;
  formatValue?: (n: number) => string;
  color?: string;
}> = ({ data, height = 180, formatValue = (n) => n.toLocaleString(), color = '#1D4ED8' }) => {
  const width = 560;
  const padX = 8;
  const padY = 14;
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const pts = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padY + innerH - (d.value / max) * innerH,
    ...d,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1]?.x ?? padX},${padY + innerH} L${padX},${padY + innerH} Z`;

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => padY + innerH * (1 - f));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridLines.map((y) => (
          <line
            key={y}
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
            stroke="#DBEAFE"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}
        <motion.path
          d={areaPath}
          fill="url(#areaFill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
        {pts.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill="#fff"
            stroke={color}
            strokeWidth="2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.06 }}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-[#3B5998] mt-1 px-1">
        <span>{data[0]?.label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <div className="mt-2 text-right text-xs text-[#3B5998]">
        Peak: <span className="font-semibold text-[#0A1936] tabular-nums">{formatValue(max)}</span>
      </div>
    </div>
  );
};

export const AnimatedBar: React.FC<{
  pct: number; // 0-100
  className?: string;
  delay?: number;
}> = ({ pct, className = 'bg-[#1D4ED8]', delay = 0 }) => (
  <motion.div
    className={`h-full rounded-full ${className}`}
    initial={{ width: 0 }}
    animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
    transition={{ duration: 0.8, delay, ease: 'easeOut' }}
  />
);

export { CountUp };
