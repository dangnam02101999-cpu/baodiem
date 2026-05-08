import React from 'react';

interface Target4Props {
  className?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  hits?: ({ x: number; y: number } | null)[];
  currentH?: number;
}

export const Target4 = ({ className, onClick, hits = [], currentH = 0 }: Target4Props) => {
  return (
    <svg
      viewBox="0 0 636 572"
      className={className}
      onClick={onClick}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background */}
      <rect width="636" height="572" fill="white" />

      {/* Silhouette Shape (Bia số 4) */}
      <path
        d="M208 25 Q318 0 428 25 L458 140 L458 200 L636 290 L636 572 L0 572 L0 290 L178 200 L178 140 Z"
        fill="#1a1c1c"
      />
      
      {/* Target Rings (Centered at 318, 300) */}
      <g fill="none" stroke="white" strokeWidth="1.5">
        <circle cx="318" cy="300" r="50" /> {/* 10 */}
        <circle cx="318" cy="300" r="100" /> {/* 9 */}
        <circle cx="318" cy="300" r="150" /> {/* 8 */}
        <circle cx="318" cy="300" r="200" /> {/* 7 */}
        <circle cx="318" cy="300" r="250" /> {/* 6 */}
        <circle cx="318" cy="300" r="300" /> {/* 5 */}
        <circle cx="318" cy="300" r="350" /> {/* 4 (partial) */}
      </g>

      {/* Point Labels - Aligned diagonally to bottom corners and vertically to top */}
      <g fill="white" fontSize="22" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
        <text x="318" y="310">10</text>
        
        {/* Top vertical row */}
        <text x="318" y="235">9</text>
        <text x="318" y="185">8</text>
        <text x="318" y="135">7</text>
        <text x="318" y="85">6</text>
        
        {/* Left diagonal row (towards bottom-left) */}
        <text x="265" y="353">9</text>
        <text x="230" y="388">8</text>
        <text x="194" y="424">7</text>
        <text x="159" y="459">6</text>
        <text x="124" y="495">5</text>
        <text x="88" y="531">4</text>

        {/* Right diagonal row (towards bottom-right) */}
        <text x="371" y="353">9</text>
        <text x="406" y="388">8</text>
        <text x="442" y="424">7</text>
        <text x="477" y="459">6</text>
        <text x="512" y="495">5</text>
        <text x="548" y="531">4</text>
      </g>

      {/* Changed Label from BIA SỐ 10 to BIA SỐ 4 */}
      <text x="520" y="70" fill="#1a1c1c" fontSize="24" fontWeight="900" fontFamily="sans-serif">BIA SỐ 4</text>

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
