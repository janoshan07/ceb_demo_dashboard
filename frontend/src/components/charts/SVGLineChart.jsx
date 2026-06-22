import React, { useState } from 'react';

const SVGLineChart = ({
  data = [],
  dataKey = 'value',
  labelKey = 'label',
  strokeColor = '#3b82f6',
  fillGradientId = 'blue-gradient',
  fillColorStart = 'rgba(59, 130, 246, 0.3)',
  fillColorEnd = 'rgba(59, 130, 246, 0)',
  tooltipSuffix = '',
  formatter = (val) => val.toLocaleString(),
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px', color: 'var(--text-muted)' }}>
        No trend data available.
      </div>
    );
  }

  // Width and Height in coordinate space
  const svgWidth = 600;
  const svgHeight = 220;

  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Extract values
  const values = data.map(item => Number(item[dataKey]) || 0);
  const labels = data.map(item => item[labelKey] || '');

  let maxVal = Math.max(...values, 10);
  let minVal = Math.min(...values, 0);

  // If both min and max are 0, make some range
  if (maxVal === minVal) {
    maxVal += 10;
    minVal -= 10;
  }

  // Add 10% headroom
  const valRange = maxVal - minVal;
  const adjustedMax = maxVal + valRange * 0.1;
  const adjustedMin = minVal - (valRange * 0.05); // slightly below min
  const adjustedRange = adjustedMax - adjustedMin;

  // Helper to map data index to X coordinate
  const getX = (index) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  // Helper to map data value to Y coordinate
  const getY = (val) => {
    const scale = chartHeight / adjustedRange;
    return svgHeight - paddingBottom - (val - adjustedMin) * scale;
  };

  // Generate points for the path
  const points = data.map((item, index) => ({
    x: getX(index),
    y: getY(item[dataKey]),
    val: item[dataKey],
    label: item[labelKey]
  }));

  // Build the path string
  let pathD = '';
  let areaD = '';

  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    // To fill area, connect to bottom of chart
    const yBottom = getY(Math.max(adjustedMin, 0)); // fill down to Y=0 or bottom
    areaD = `${pathD} L ${points[points.length - 1].x} ${yBottom} L ${points[0].x} ${yBottom} Z`;
  }

  // Zero reference line
  const zeroY = getY(0);
  const showZeroLine = adjustedMin < 0 && adjustedMax > 0;

  // Y-Axis tick values
  const yTicks = [
    adjustedMin + adjustedRange * 0.1,
    adjustedMin + adjustedRange * 0.5,
    adjustedMin + adjustedRange * 0.9,
  ];

  const handleMouseMove = (e, index, point) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgRect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    
    // Calculate tooltip relative position
    const tooltipX = rect.left - svgRect.left + rect.width / 2;
    const tooltipY = rect.top - svgRect.top - 40;

    setHoveredIndex(index);
    setTooltipPos({ x: tooltipX, y: tooltipY });
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Tooltip Portal */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="chart-tooltip-portal"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
            opacity: 1,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {points[hoveredIndex].label}
          </div>
          <div style={{ color: points[hoveredIndex].val >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.9rem', fontWeight: 700 }}>
            {points[hoveredIndex].val > 0 ? '+' : ''}{formatter(points[hoveredIndex].val)}{tooltipSuffix}
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColorStart} />
            <stop offset="100%" stopColor={fillColorEnd} />
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={strokeColor} floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Grid lines (horizontal) */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={paddingLeft}
            y1={getY(tick)}
            x2={svgWidth - paddingRight}
            y2={getY(tick)}
            stroke="var(--border-color)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Y Axis Reference values */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={paddingLeft - 8}
            y={getY(tick) + 4}
            fill="var(--text-muted)"
            fontSize="10"
            textAnchor="end"
            fontWeight="500"
          >
            {formatter(tick)}
          </text>
        ))}

        {/* Y=0 Reference Line */}
        {showZeroLine && (
          <line
            x1={paddingLeft}
            y1={zeroY}
            x2={svgWidth - paddingRight}
            y2={zeroY}
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            opacity="0.6"
          />
        )}

        {/* Area fill */}
        {areaD && (
          <path
            d={areaD}
            fill={`url(#${fillGradientId})`}
            opacity="0.85"
            style={{ transition: 'd 0.3s' }}
          />
        )}

        {/* Line stroke */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#shadow)"
            style={{ transition: 'd 0.3s' }}
          />
        )}

        {/* X Axis Labels */}
        {points.map((p, i) => (
          // Render label for every point, or skip to avoid clutter if list is long
          (points.length <= 12 || i % 2 === 0) && (
            <text
              key={i}
              x={p.x}
              y={svgHeight - paddingBottom + 18}
              fill="var(--text-muted)"
              fontSize="10"
              textAnchor="middle"
              fontWeight="500"
            >
              {p.label}
            </text>
          )
        ))}

        {/* Interactive points */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Transparent hover catcher circle */}
            <circle
              cx={p.x}
              cy={p.y}
              r="15"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => handleMouseMove(e, i, p)}
              onMouseMove={(e) => handleMouseMove(e, i, p)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            {/* Visual circle dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 6 : 4}
              fill={hoveredIndex === i ? strokeColor : 'var(--bg-secondary)'}
              stroke={strokeColor}
              strokeWidth="2"
              className="svg-chart-interactive-point"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

export default SVGLineChart;
