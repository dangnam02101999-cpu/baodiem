import React from 'react';

interface Target7Props {
  className?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  hits?: ({ x: number; y: number } | null)[];
  currentH?: number;
}

export const Target7 = ({ className, onClick, hits = [], currentH = 0 }: Target7Props) => {
  return (
    <svg
      viewBox="0 0 600 900"
      className={className}
      onClick={onClick}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background */}
      <rect width="600" height="900" fill="white" />

      {/* Camouflage Pattern Definition */}
      <defs>
        <pattern id="camoPattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
          <rect width="200" height="200" fill="#2d3436" />
          <path d="M0 0 Q50 20 100 0 Q150 30 200 0 V50 Q120 80 50 50 Z" fill="#1e272e" opacity="0.6" />
          <path d="M50 100 Q100 70 150 100 Q200 130 150 180 Q100 150 50 180 Z" fill="#4b4b4b" opacity="0.4" />
          <path d="M150 0 Q180 50 150 100 Q120 50 150 0" fill="#000000" opacity="0.3" />
        </pattern>
      </defs>

      {/* Silhouette Shape (Bia số 7 - Refined figure with Camo - Narrower) */}
      <path
        d="M300 45 Q195 45 195 130 V180 L120 220 V800 L175 840 H425 L480 800 V260 L405 210 V130 Q405 45 300 45 Z"
        fill="url(#camoPattern)"
        stroke="#1a1c1c"
        strokeWidth="2"
      />
      
      {/* Target Rings (10 is a circle, outer rings expand slightly downwards) */}
      <g fill="none" stroke="white" strokeWidth="1.5" opacity="0.8">
        {[55, 95, 135, 175, 215, 255, 295, 335, 375, 415].map((r, i) => {
          const isExp = i >= 3;
          return i === 0 ? (
            <circle key={i} cx="300" cy="250" r="55" />
          ) : (
            <ellipse 
              key={i} 
              cx="300" 
              cy={isExp ? 260 : 250} 
              rx={r * 1.10} 
              ry={r * (isExp ? 1.45 : 1.35)} 
            />
          );
        })}
      </g>

      {/* Point Labels - Recalculated for shifted/expanded rings */}
      <g fill="white" fontSize="24" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
        <text x="300" y="258">10</text>
        <text x="300" y="351">9</text>
        <text x="300" y="405">8</text>
        <text x="300" y="473">7</text>
        <text x="300" y="535">6</text>
        <text x="300" y="585">5</text>
        <text x="300" y="635">4</text>
        <text x="300" y="685">3</text>
        <text x="300" y="735">2</text>
        <text x="300" y="785" fontSize="22">1</text>
      </g>

      <text x="470" y="60" fill="#1a1c1c" fontSize="24" fontWeight="900" fontFamily="sans-serif">BIA SỐ 7</text>

      {/* Hit Markers */}
      {hits.map((hit, i) => hit && (
        <g key={i} transform={`translate(${300 + (hit.x * 6)}, ${250 + (hit.y * 9)})`}>
          <circle
            r="12"
            fill={currentH === i ? "#dfe8a6" : "#ffffff"}
            stroke="#1a1c1c"
            strokeWidth="2"
            className="drop-shadow-md"
          />
          <text
            y="4"
            fill="#1a1c1c"
            fontSize="10"
            fontWeight="900"
            textAnchor="middle"
          >
            H{i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
};
