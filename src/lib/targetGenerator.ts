
/**
 * Utility to generate target images (Base64) for Excel export.
 * Replicates the SVG drawings from Target4, Target7, and Target8 components on a Canvas.
 */

export async function generateTargetImage(
  targetType: number, 
  hits: ({ x: number; y: number } | null)[] = []
): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (targetType === 4) {
    canvas.width = 636;
    canvas.height = 572;
    drawTarget4(ctx, hits);
  } else if (targetType === 7) {
    canvas.width = 600;
    canvas.height = 900;
    drawTarget7(ctx, hits);
  } else if (targetType === 8) {
    canvas.width = 600;
    canvas.height = 1200;
    drawTarget8(ctx, hits);
  }

  return canvas.toDataURL('image/png');
}

function drawTarget4(ctx: CanvasRenderingContext2D, hits: any[]) {
  // Background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 636, 572);

  // Silhouette
  ctx.fillStyle = '#1a1c1c';
  ctx.beginPath();
  // d="M208 25 Q318 0 428 25 L458 140 L458 200 L636 290 L636 572 L0 572 L0 290 L178 200 L178 140 Z"
  ctx.moveTo(208, 25);
  ctx.quadraticCurveTo(318, 0, 428, 25);
  ctx.lineTo(458, 140);
  ctx.lineTo(458, 200);
  ctx.lineTo(636, 290);
  ctx.lineTo(636, 572);
  ctx.lineTo(0, 572);
  ctx.lineTo(0, 290);
  ctx.lineTo(178, 200);
  ctx.lineTo(178, 140);
  ctx.closePath();
  ctx.fill();

  // Rings
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.5;
  const cx = 318, cy = 300;
  for (let r = 50; r <= 350; r += 50) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Labels
  ctx.fillStyle = 'white';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('10', cx, cy + 10);
  
  // Top vertical
  [9, 8, 7, 6].forEach((val, i) => ctx.fillText(val.toString(), cx, 235 - i * 50));
  
  // Left diagonal
  const leftHits = [
    {x: 265, y: 353, label: '9'},
    {x: 230, y: 388, label: '8'},
    {x: 194, y: 424, label: '7'},
    {x: 159, y: 459, label: '6'},
    {x: 124, y: 495, label: '5'},
    {x: 88, y: 531, label: '4'}
  ];
  leftHits.forEach(h => ctx.fillText(h.label, h.x, h.y));

  // Right diagonal
  const rightHits = [
    {x: 371, y: 353, label: '9'},
    {x: 406, y: 388, label: '8'},
    {x: 442, y: 424, label: '7'},
    {x: 477, y: 459, label: '6'},
    {x: 512, y: 495, label: '5'},
    {x: 548, y: 531, label: '4'}
  ];
  rightHits.forEach(h => ctx.fillText(h.label, h.x, h.y));

  ctx.fillStyle = '#1a1c1c';
  ctx.font = '900 24px sans-serif';
  ctx.fillText('BIA SỐ 4', 520, 70);

  // Hits
  drawHits(ctx, hits, 318, 300, 6.36, 5.72);
}

function drawTarget7(ctx: CanvasRenderingContext2D, hits: any[]) {
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 600, 900);

  // Simplified Camo (solid color for now, pattern is complex for canvas)
  ctx.fillStyle = '#2d3436';
  ctx.beginPath();
  // d="M300 45 Q195 45 195 130 V180 L120 220 V800 L175 840 H425 L480 800 V260 L405 210 V130 Q405 45 300 45 Z"
  ctx.moveTo(300, 45);
  ctx.quadraticCurveTo(195, 45, 195, 130);
  ctx.lineTo(195, 180);
  ctx.lineTo(120, 220);
  ctx.lineTo(120, 800);
  ctx.lineTo(175, 840);
  ctx.lineTo(425, 840);
  ctx.lineTo(480, 800);
  ctx.lineTo(480, 260);
  ctx.lineTo(405, 210);
  ctx.lineTo(405, 130);
  ctx.quadraticCurveTo(405, 45, 300, 45);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a1c1c';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.5;
  [55, 95, 135, 175, 215, 255, 295, 335, 375, 415].map((r, i) => {
    const isExp = i >= 3;
    const cx = 300, cy = isExp ? 260 : 250;
    const rx = r * 1.10, ry = r * (isExp ? 1.45 : 1.35);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Labels
  ctx.fillStyle = 'white';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  const labels = [
    {y: 258, v: '10'}, {y: 351, v: '9'}, {y: 405, v: '8'}, {y: 473, v: '7'},
    {y: 535, v: '6'}, {y: 585, v: '5'}, {y: 635, v: '4'}, {y: 685, v: '3'},
    {y: 735, v: '2'}, {y: 785, v: '1'}
  ];
  labels.forEach(l => ctx.fillText(l.v, 300, l.y));

  ctx.fillStyle = '#1a1c1c';
  ctx.fillText('BIA SỐ 7', 470, 60);

  // Hits
  drawHits(ctx, hits, 300, 250, 6, 9);
}

function drawTarget8(ctx: CanvasRenderingContext2D, hits: any[]) {
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 600, 1200);

  ctx.fillStyle = '#1a1c1c';
  ctx.beginPath();
  // d="M220 230 L220 150 Q220 90 260 90 L340 90 Q380 90 380 150 L380 260 L450 300 L450 775 L400 1150 L200 1150 L150 775 L150 240 Z"
  ctx.moveTo(220, 230);
  ctx.lineTo(220, 150);
  ctx.quadraticCurveTo(220, 90, 260, 90);
  ctx.lineTo(340, 90);
  ctx.quadraticCurveTo(380, 90, 380, 150);
  ctx.lineTo(380, 260);
  ctx.lineTo(450, 300);
  ctx.lineTo(450, 775);
  ctx.lineTo(400, 1150);
  ctx.lineTo(200, 1150);
  ctx.lineTo(150, 775);
  ctx.lineTo(150, 240);
  ctx.closePath();
  ctx.fill();

  // Rings
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(300, 325, 45, 0, Math.PI * 2);
  ctx.stroke();

  [100, 165, 230, 295, 360, 425, 490, 555].forEach((r, i) => {
    let cy = 325;
    let ry = r * 1.1;
    let rxMult = 0.8;
    if (i === 1) rxMult = 0.72;
    if (i >= 2) {
      const bottom = 325 + (r * 1.1);
      ry = r * 2.1; 
      cy = bottom - ry;
    }
    ctx.beginPath();
    ctx.ellipse(300, cy, r * rxMult, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Labels
  ctx.fillStyle = 'white';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  const labels = [
    {y: 334, v: '10'}, {y: 403, v: '9'}, {y: 471, v: '8'}, {y: 542, v: '7'},
    {y: 614, v: '6'}, {y: 685, v: '5'}, {y: 757, v: '4'}, {y: 828, v: '3'},
    {y: 900, v: '2'}, {y: 975, v: '1'}
  ];
  labels.forEach(l => ctx.fillText(l.v, 300, l.y));

  ctx.fillStyle = '#1a1c1c';
  ctx.fillText('BIA SỐ 8', 480, 90);

  // Hits
  drawHits(ctx, hits, 300, 325, 6, 12);
}

function drawHits(ctx: CanvasRenderingContext2D, hits: any[], cx: number, cy: number, scaleX: number, scaleY: number) {
  hits.forEach((hit, i) => {
    if (!hit) return;
    const x = cx + (hit.x * scaleX);
    const y = cy + (hit.y * scaleY);

    // Marker shadow/glow
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';

    // Marker circle
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#1a1c1c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0; // reset

    // Text H1, H2, etc
    ctx.fillStyle = '#1a1c1c';
    ctx.font = '900 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`H${i+1}`, x, y + 6);
  });
}
