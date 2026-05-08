import React from 'react';

interface Target8Props {
  className?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  hits?: ({ x: number; y: number } | null)[];
  currentH?: number;
}

export const Target8 = ({ className, onClick, hits = [], currentH = 0 }: Target8Props) => {
  return (
    <svg
      viewBox="0 0 600 1200"
      className={className}
      onClick={onClick}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background */}
      <rect width="600" height="1200" fill="white" />

      {/* Silhouette Shape (Bia số 8 - Taller humanoid) */}
      <path
        d="M220 230 L220 150 Q220 90 260 90 L340 90 Q380 90 380 150 L380 260 L450 300 L450 775 L400 1150 L200 1150 L150 775 L150 240 Z"
        fill="#1a1c1c"
      />
      
      {/* Target Rings (Center at 325, outer rings taller with fixed bottom) */}
      <g fill="none" stroke="white" strokeWidth="1.2">
        <circle cx="300" cy="325" r="45" />
        {[100, 165, 230, 295, 360, 425, 490, 555].map((r, i) => {
          let cy = 325;
          let ry = r * 1.1;
          let rxMult = 0.8;
          if (i === 1) rxMult = 0.72;
          if (i >= 2) {
            // Rings 7 down to 2: Increase vertical span further but keep bottom fixed
            const bottom = 325 + (r * 1.1);
            ry = r * 2.1; 
            cy = bottom - ry;
          }
          return <ellipse key={i} cx="300" cy={cy} rx={r * rxMult} ry={ry} />;
        })}
      </g>

      {/* Point Labels - Vertically aligned from 10 to 1 */}
      <g fill="white" fontSize="24" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
        <text x="300" y="334">10</text>
        <text x="300" y="403">9</text>
        <text x="300" y="471">8</text>
        <text x="300" y="542">7</text>
        <text x="300" y="614">6</text>
        <text x="300" y="685">5</text>
        <text x="300" y="757">4</text>
        <text x="300" y="828">3</text>
        <text x="300" y="900">2</text>
        <text x="300" y="975" fontSize="20">1</text>
      </g>

      <text x="480" y="90" fill="#1a1c1c" fontSize="24" fontWeight="900" fontFamily="sans-serif">BIA SỐ 8</text>

      {/* Hit Markers */}
      {hits.map((hit, i) => hit && (
        <g key={i} transform={`translate(${300 + (hit.x * 6)}, ${325 + (hit.y * 12)})`}>
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
