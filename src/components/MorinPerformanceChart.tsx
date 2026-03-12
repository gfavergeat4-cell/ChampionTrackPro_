/**
 * MorinPerformanceChart.tsx
 * Zone-based energy chart: colored bars (GREEN/BLUE/YELLOW) + EMA dashed trendline.
 * Uses Recharts ComposedChart. No numbers on hover — just zone context.
 */

import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MorinDataPoint, MorinZone } from '../utils/useMorinAlgorithm';
import { MORIN_COLORS } from '../utils/useMorinAlgorithm';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MorinPerformanceChartProps {
  data: MorinDataPoint[];
  metricLabel: string;   // e.g. "Physical Engine"
  height?: number;       // default 220
  showLegend?: boolean;  // default true
}

// ─── Zone labels for tooltip ──────────────────────────────────────────────────

const ZONE_LABELS: Record<MorinZone, string> = {
  GREEN:             'Normal adaptation',
  BLUE:              'Under-load / Recovery',
  YELLOW:            'Unusual spike — monitor',
  INSUFFICIENT_DATA: 'Insufficient data',
};

const ZONE_DOTS: Record<MorinZone, string> = {
  GREEN:             '🟢',
  BLUE:              '🔵',
  YELLOW:            '🟡',
  INSUFFICIENT_DATA: '⬜',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtXTick(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function fmtFullDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: '2-digit', timeZone: 'UTC',
  });
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as MorinDataPoint;
  if (!point) return null;

  const zoneColor = MORIN_COLORS[point.zone];

  return (
    <div style={{
      background: '#0D1526',
      border: '1px solid rgba(0,212,255,0.20)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontSize: 12,
      minWidth: 178,
    }}>
      {/* Date */}
      <div style={{ color: 'rgba(255,255,255,0.50)', marginBottom: 8, fontSize: 11, letterSpacing: '0.5px' }}>
        {fmtFullDate(label || point.date)}
      </div>

      {/* Raw Score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>Raw Score</span>
        <span style={{ color: '#FFFFFF', fontWeight: 600 }}>
          {point.rawScore !== null ? `${point.rawScore}/100` : 'No data'}
        </span>
      </div>

      {/* Baseline EMA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>Baseline</span>
        <span style={{ color: 'rgba(255,255,255,0.80)' }}>
          {Math.round(point.ema)}/100
        </span>
      </div>

      {/* Deviation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 10 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>Deviation</span>
        <span style={{
          color: point.deviation === null
            ? 'rgba(255,255,255,0.45)'
            : point.deviation > 0 ? '#FFB800' : '#00C853',
          fontWeight: point.deviation !== null ? 600 : 400,
        }}>
          {point.deviation !== null
            ? `${point.deviation > 0 ? '+' : ''}${point.deviation}%`
            : '—'}
        </span>
      </div>

      {/* Zone */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTop: '1px solid rgba(255,255,255,0.07)',
        fontSize: 11,
        color: zoneColor,
        fontWeight: 500,
      }}>
        {ZONE_DOTS[point.zone]} {ZONE_LABELS[point.zone]}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MorinPerformanceChart({
  data,
  metricLabel,
  height = 220,
  showLegend = true,
}: MorinPerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.22)',
        fontSize: 13,
        fontFamily: "'DM Sans', system-ui",
        fontStyle: 'italic',
      }}>
        No V3 data available yet
      </div>
    );
  }

  // X-axis: show a tick every 7 days
  const xTicks = data
    .map((d, i) => ({ date: d.date, i }))
    .filter(({ i }) => i % 7 === 0)
    .map(({ date }) => date);

  return (
    <div style={{ width: '100%' }}>
      {/* Section label (Space Mono, cyan) */}
      <div style={{
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        color: 'rgba(0,212,255,0.60)',
        marginBottom: 8,
        paddingLeft: 4,
      }}>
        {metricLabel}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 6, left: -8, bottom: 16 }}
        >
          {/* Horizontal grid lines only */}
          <CartesianGrid
            horizontal={true}
            vertical={false}
            stroke="rgba(255,255,255,0.06)"
          />

          {/* X axis — week markers only, no numbers */}
          <XAxis
            dataKey="date"
            ticks={xTicks}
            tickFormatter={fmtXTick}
            tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />

          {/* Y axis — 0 to 100 */}
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={26}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />

          {/* Bars — colored by zone */}
          <Bar
            dataKey="rawScore"
            maxBarSize={18}
            radius={[3, 3, 0, 0] as any}
            isAnimationActive={false}
          >
            {data.map((point, i) => (
              <Cell
                key={i}
                fill={MORIN_COLORS[point.zone]}
                fillOpacity={point.rawScore === null ? 0 : 0.85}
              />
            ))}
          </Bar>

          {/* EMA trendline — dashed, continuous even across gaps */}
          <Line
            type="monotone"
            dataKey="ema"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            name="Personal Baseline (EMA)"
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      {showLegend && (
        <div style={{
          display: 'flex',
          gap: 14,
          justifyContent: 'center',
          marginTop: 4,
          flexWrap: 'wrap',
        }}>
          {(
            [
              { zone: 'GREEN'  as MorinZone, label: 'Normal' },
              { zone: 'BLUE'   as MorinZone, label: 'Under-load' },
              { zone: 'YELLOW' as MorinZone, label: 'Spike' },
            ] as const
          ).map(({ zone, label }) => (
            <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: MORIN_COLORS[zone],
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.50)',
                fontFamily: "'DM Sans', system-ui",
              }}>
                {label}
              </span>
            </div>
          ))}
          {/* EMA indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 18,
              height: 2,
              background: 'rgba(255,255,255,0.35)',
              borderTop: '1px dashed rgba(255,255,255,0.35)',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.50)',
              fontFamily: "'DM Sans', system-ui",
            }}>
              Baseline
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
