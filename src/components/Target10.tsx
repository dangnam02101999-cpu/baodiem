import React from 'react';

interface Target10Props {
  className?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  hits?: ({ x: number; y: number } | null)[];
  currentH?: number;
}

export const Target10 = ({ className, onClick, hits = [], currentH = 0 }: Target10Props) => {
  return (
    <svg
      viewBox="0 0 636 572"
      className={className}
      onClick={onClick}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background */}
      <rect width="636" height="572" fill="white" />

      {/* Silhouette Shape (Bia số 10) */}
      <path
        d="M218 40 Q318 20 418 40 L418 140 L636 210 L636 572 L0 572 L0 210 L218 140 Z"
        fill="#1a1c1c"
      />
      
      {/* Target Rings (Centered at 318, 300) */}
      <g fill="none" stroke="white" strokeWidth="1.5">
        <circle cx="318" cy="300" r="45" /> {/* 10 */}
        <circle cx="318" cy="300" r="90" /> {/* 9 */}
        <circle cx="318" cy="300" r="135" /> {/* 8 */}
        <circle cx="318" cy="300" r="180" /> {/* 7 */}
        <circle cx="318" cy="300" r="225" /> {/* 6 */}
        <circle cx="318" cy="300" r="270" /> {/* 5 */}
        <circle cx="318" cy="300" r="315" /> {/* 4 (partial) */}
      </g>

      {/* Point Labels */}
      <g fill="white" fontSize="22" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
        <text x="318" y="308">10</text>
        
        {/* 9s */}
        <text x="318" y="245">9</text>
        <text x="318" y="375">9</text>
        <text x="255" y="308">9</text>
        <text x="381" y="308">9</text>

        {/* 8s */}
        <text x="318" y="175">8</text>
        <text x="215" y="375">8</text>
        <text x="421" y="375">8</text>

        {/* 7s */}
        <text x="318" y="115">7</text>
        <text x="175" y="435">7</text>
        <text x="461" y="435">7</text>

        {/* 6s */}
        <text x="318" y="70">6</text>
        <text x="135" y="495">6</text>
        <text x="501" y="495">6</text>

        {/* 5s */}
        <text x="115" y="515">5</text>
        <text x="521" y="515">5</text>

        {/* 4s at corners */}
        <text x="35" y="560">4</text>
        <text x="601" y="560">4</text>
      </g>

      <text x="520" y="70" fill="#1a1c1c" fontSize="24" fontWeight="900" fontFamily="sans-serif">BIA SỐ 10</text>

      {/* Hit Markers */}
      {hits.map((hit, i) => hit && (
        <g key={i} transform={`translate(${318 + (hit.x * 6.36)}, ${300 + (hit.y * 5.72)})`}>
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
