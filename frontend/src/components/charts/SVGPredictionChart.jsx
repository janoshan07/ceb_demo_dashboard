import React, { useState } from 'react';

const SVGPredictionChart = ({
  data = [],
  actualKey = 'actual',
  predictedKey = 'predicted',
  labelKey = 'label',
  strokeColor = '#3b82f6',
  predictedStrokeColor = '#a78bfa',
  tooltipSuffix = '',
  formatter = (val) => val.toLocaleString(),
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px', color: 'var(--text-muted)' }}>
        No predictive trend data available.
      </div>
    );
  }

  // Width and Height in coordinate space
  const svgWidth = 600;
  const svgHeight = 220;

  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 35;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Extract all values to determine axis bounds
  const actualValues = data.map(item => Number(item[actualKey]) || 0);
  const predictedValues = data.map(item => Number(item[predictedKey]) || 0);
  const allValues = [...actualValues, ...predictedValues];

  let maxVal = Math.max(...allValues, 10);
  let minVal = Math.min(...allValues, 0);

  if (maxVal === minVal) {
    maxVal += 10;
    minVal -= 10;
  }

  const valRange = maxVal - minVal;
  const adjustedMax = maxVal + valRange * 0.1;
  const adjustedMin = minVal - (valRange * 0.05);
  const adjustedRange = adjustedMax - adjustedMin;

  const getX = (index) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val) => {
    const scale = chartHeight / adjustedRange;
    return svgHeight - paddingBottom - (val - adjustedMin) * scale;
  };

  // Generate points for both series
  const actualPoints = data.map((item, index) => ({
    x: getX(index),
    y: getY(item[actualKey]),
    val: item[actualKey],
    label: item[labelKey]
  }));

  const predictedPoints = data.map((item, index) => ({
    x: getX(index),
    y: getY(item[predictedKey]),
    val: item[predictedKey]
  }));

  // Build the path strings
  let actualPathD = '';
  let actualAreaD = '';
  let predictedPathD = '';

  if (actualPoints.length > 0) {
    actualPathD = `M ${actualPoints[0].x} ${actualPoints[0].y} ` + actualPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    const yBottom = getY(Math.max(adjustedMin, 0));
    actualAreaD = `${actualPathD} L ${actualPoints[actualPoints.length - 1].x} ${yBottom} L ${actualPoints[0].x} ${yBottom} Z`;
  }

  if (predictedPoints.length > 0) {
    predictedPathD = `M ${predictedPoints[0].x} ${predictedPoints[0].y} ` + predictedPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  }

  const zeroY = getY(0);
  const showZeroLine = adjustedMin < 0 && adjustedMax > 0;

  const yTicks = [
    adjustedMin + adjustedRange * 0.1,
    adjustedMin + adjustedRange * 0.5,
    adjustedMin + adjustedRange * 0.9,
  ];

  const handleMouseMove = (e, index) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgRect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    
    const tooltipX = rect.left - svgRect.left + rect.width / 2;
    const tooltipY = rect.top - svgRect.top - 40;

    setHoveredIndex(index);
    setTooltipPos({ x: tooltipX, y: tooltipY });
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Legend Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingRight: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '3px', backgroundColor: strokeColor, borderRadius: '2px' }}></span>
          <span>Actual</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '3px', borderTop: `2px dashed ${predictedStrokeColor}` }}></span>
          <span>Predicted</span>
        </div>
      </div>

      {/* Dual Value Tooltip Overlay */}
      {hoveredIndex !== null && actualPoints[hoveredIndex] && (
        <div
          className="chart-tooltip-portal"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
            opacity: 1,
            pointerEvents: 'none',
            zIndex: 10,
            padding: '8px 12px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>
            {actualPoints[hoveredIndex].label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Actual:</span>
              <span style={{ fontWeight: 700, color: strokeColor }}>
                {formatter(actualPoints[hoveredIndex].val)}{tooltipSuffix}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Predicted:</span>
              <span style={{ fontWeight: 700, color: predictedStrokeColor }}>
                {formatter(predictedPoints[hoveredIndex].val)}{tooltipSuffix}
              </span>
            </div>
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${actualKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
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

        {/* Area fill for Actual */}
        {actualAreaD && (
          <path
            d={actualAreaD}
            fill={`url(#grad-${actualKey})`}
            opacity="0.8"
            style={{ transition: 'd 0.3s' }}
          />
        )}

        {/* Solid Line stroke for Actual */}
        {actualPathD && (
          <path
            d={actualPathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'd 0.3s' }}
          />
        )}

        {/* Dashed Line stroke for Predicted */}
        {predictedPathD && (
          <path
            d={predictedPathD}
            fill="none"
            stroke={predictedStrokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 4"
            style={{ transition: 'd 0.3s' }}
          />
        )}

        {/* X Axis Labels */}
        {actualPoints.map((p, i) => (
          (actualPoints.length <= 12 || i % 2 === 0) && (
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

        {/* Interactive hover catchers */}
        {actualPoints.map((p, i) => (
          <g key={i}>
            {/* Transparent hover catcher circle */}
            <circle
              cx={p.x}
              cy={p.y}
              r="15"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => handleMouseMove(e, i)}
              onMouseMove={(e) => handleMouseMove(e, i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            {/* Visual circle dot for Actual */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 5 : 3}
              fill={hoveredIndex === i ? strokeColor : 'var(--bg-secondary)'}
              stroke={strokeColor}
              strokeWidth="2"
              style={{ pointerEvents: 'none', transition: 'r 0.15s' }}
            />
            {/* Visual circle dot for Predicted */}
            <circle
              cx={predictedPoints[i].x}
              cy={predictedPoints[i].y}
              r={hoveredIndex === i ? 4 : 2}
              fill="transparent"
              stroke={predictedStrokeColor}
              strokeWidth="1.5"
              strokeDasharray={hoveredIndex === i ? "none" : "2 1"}
              style={{ pointerEvents: 'none', transition: 'r 0.15s' }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

export default SVGPredictionChart;
