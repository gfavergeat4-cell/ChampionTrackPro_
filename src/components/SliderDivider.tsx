import React from 'react';

export const SliderDivider = () => (
  <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
    <svg width='80' height='18' viewBox='0 0 80 18'>
      <defs>
        <linearGradient id='sdg' x1='0%' y1='0%' x2='100%' y2='0%'>
          <stop offset='0%' stopColor='#0044FF' stopOpacity={0.4}/>
          <stop offset='50%' stopColor='#00D4FF'/>
          <stop offset='100%' stopColor='#0044FF' stopOpacity={0.4}/>
        </linearGradient>
        <filter id='sf'>
          <feGaussianBlur stdDeviation='2' result='b'/>
          <feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge>
        </filter>
      </defs>
      <line x1='4' y1='9' x2='76' y2='9' stroke='url(#sdg)' strokeWidth='2' strokeLinecap='round'/>
      <circle cx='40' cy='9' r='4' fill='#00D4FF' filter='url(#sf)'/>
      <circle cx='40' cy='9' r='2' fill='#ffffff'/>
    </svg>
  </div>
);
