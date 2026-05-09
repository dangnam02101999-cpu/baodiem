
import ExcelJS from 'exceljs';
import { generateTargetImage } from './targetGenerator';

export async function exportResultsToExcel(data: any[], fileName: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Kết quả');

  // Define columns - Reorganized to group score columns and image columns
  worksheet.columns = [
    { header: 'STT', key: 'stt', width: 5 },
    { header: 'Họ và Tên', key: 'name', width: 25 },
    { header: 'Cấp bậc', key: 'rank', width: 12 },
    { header: 'Chức vụ', key: 'position', width: 15 },
    { header: 'Đơn vị', key: 'unit', width: 15 },
    { header: 'Dải', key: 'lane', width: 6 },
    { header: 'Bia 4', key: 't4', width: 10 },
    { header: 'Bia 7', key: 't7', width: 10 },
    { header: 'Bia 8', key: 't8', width: 10 },
    { header: 'Tổng', key: 'total', width: 10 },
    { header: 'Xếp loại', key: 'classification', width: 15 },
    // Image columns will be at the end and grouped
    { header: 'Ảnh Bia 4', key: 'img4', width: 35 },
    { header: 'Ảnh Bia 7', key: 'img7', width: 35 },
    { header: 'Ảnh Bia 8', key: 'img8', width: 35 },
    { header: 'Thời gian', key: 'timestamp', width: 20 },
  ];

  // Group image columns (L, M, N) which are indices 12, 13, 14
  // We'll hide them by default so user can "expand" to see images
  for (let i = 12; i <= 14; i++) {
    const col = worksheet.getColumn(i);
    col.outlineLevel = 1;
    // col.hidden = true; // Optional: hide by default
  }

  // Formatting header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const row = worksheet.addRow({
      stt: i + 1,
      name: r.name,
      rank: r.rank,
      position: r.position,
      unit: r.unit,
      lane: r.lane,
      t4: r.scores.target4,
      t7: r.scores.target7,
      t8: r.scores.target8,
      total: r.total,
      classification: r.classification,
      timestamp: r.timestamp ? new Date(r.timestamp).toLocaleString() : ''
    });

    row.height = 100; // Default height for rows to accommodate images
    row.alignment = { vertical: 'middle', horizontal: 'center' };

    // Process Target 4 - Column L (index 11)
    if (r.hits && r.hits.target4) {
      const imgBase64 = await generateTargetImage(4, r.hits.target4);
      const imageId = workbook.addImage({
        base64: imgBase64,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 11, row: i + 1 },
        ext: { width: 240, height: 215 }
      });
    }

    // Process Target 7 - Column M (index 12)
    if (r.hits && r.hits.target7) {
      const imgBase64 = await generateTargetImage(7, r.hits.target7);
      const imageId = workbook.addImage({
        base64: imgBase64,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 12, row: i + 1 },
        ext: { width: 240, height: 360 }
      });
      if (row.height < 280) row.height = 280;
    }

    // Process Target 8 - Column N (index 13)
    if (r.hits && r.hits.target8) {
      const imgBase64 = await generateTargetImage(8, r.hits.target8);
      const imageId = workbook.addImage({
        base64: imgBase64,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 13, row: i + 1 },
        ext: { width: 240, height: 480 }
      });
      if (row.height < 380) row.height = 380;
    }
  }

  // Set worksheet options for grouping
  worksheet.properties.outlineLevelCol = 1;
  worksheet.properties.showGridLines = true;

  // Write to buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
