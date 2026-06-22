import React, { useState } from 'react';

const SVGDonutChart = ({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
  centerLabel = 'Total'
}) => {
  const [activeIndex, setActiveIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px', color: 'var(--text-muted)' }}>
        No segment data available.
      </div>
    );
  }

  // Calculate total value
  const total = data.reduce((acc, curr) => acc + (Number(curr[valueKey]) || 0), 0);

  // SVG Circle math parameters
  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~314.16

  // Generate segment angles/offsets
  let accumulatedPercent = 0;
  const segments = data.map((item, index) => {
    const val = Number(item[valueKey]) || 0;
    const percent = total > 0 ? (val / total) * 100 : 0;
    const strokeLength = (percent / 100) * circumference;
    const strokeOffset = -((accumulatedPercent / 100) * circumference);
    
    accumulatedPercent += percent;

    return {
      ...item,
      val,
      percent,
      strokeLength,
      strokeOffset,
      color: colors[index % colors.length]
    };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center', width: '100%', height: '100%' }}>
      {/* Visual Chart */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '180px', margin: '0 auto' }}>
        <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          {/* Inner backing track circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="transparent"
            stroke="var(--border-color)"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={activeIndex === i ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={`${seg.strokeLength} ${circumference}`}
              strokeDashoffset={seg.strokeOffset}
              strokeLinecap={seg.percent === 100 ? 'butt' : 'round'}
              className="donut-slice"
              style={{
                transition: 'stroke-width 0.25s, stroke-dashoffset 0.3s',
                transformOrigin: '60px 60px',
                scale: activeIndex === i ? '1.02' : '1'
              }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          ))}
        </svg>

        {/* Center overlay labels (rotated back horizontally) */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          {activeIndex !== null ? (
            <>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {segments[activeIndex][nameKey]}
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: segments[activeIndex].color }}>
                {segments[activeIndex].percent.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {centerLabel}
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                {total.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legends & Metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', paddingLeft: '0.5rem' }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              padding: '0.35rem 0.5rem',
              borderRadius: '6px',
              backgroundColor: activeIndex === i ? 'rgba(255,255,255,0.03)' : 'transparent',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: seg.color, display: 'inline-block' }}></span>
              <span style={{ fontWeight: activeIndex === i ? 600 : 500, color: activeIndex === i ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {seg[nameKey]}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{seg.val.toLocaleString()}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '38px', textAlign: 'right' }}>
                ({seg.percent.toFixed(0)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SVGDonutChart;
