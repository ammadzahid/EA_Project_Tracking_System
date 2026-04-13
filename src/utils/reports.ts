import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project } from '../types';
import { getFileDownloadUrl, viewFileInBrowser } from '../store';

function getLastY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY || 120;
}

function formatDate(d: string | undefined | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDateOnly(d: string | undefined | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' });
}

function addHeader(doc: jsPDF, title: string, project: Project) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('Solar Project Tracking System', 14, 16);
  doc.setFontSize(13);
  doc.text(title, 14, 27);
  doc.setFontSize(8);
  doc.text('Generated: ' + new Date().toLocaleString('en-PK'), 14, 38);
  if (project.workOrderNumber) {
    doc.setFontSize(13);
    doc.text('WO: ' + project.workOrderNumber, pageWidth - 14, 16, { align: 'right' });
  }
  doc.setFontSize(8);
  doc.text('Status: ' + project.status.replace('_', ' ').toUpperCase(), pageWidth - 14, 27, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

// ============================================
// FIXED: Quotation file section without link
// ============================================
function addProjectInfoTable(doc: jsPDF, project: Project, startY: number, showBudget = true): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const daysLeft = Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const details: string[][] = [
    ['Project Name', project.name],
    ['Location', project.location],
    ['City', project.city],
    ...(showBudget ? [['Budget', 'PKR ' + project.budget.toLocaleString()]] : []),
    ['Capacity', project.capacity],
    ['Project Type', project.projectType],
    ['Deadline', formatDateOnly(project.deadline)],
    ['Deadline Status', daysLeft < 0 ? '⚠ ' + Math.abs(daysLeft) + ' DAYS OVERDUE' : daysLeft + ' days remaining'],
    ['Status', project.status.replace('_', ' ').toUpperCase()],
    ['Created At', formatDate(project.createdAt)],
    ['Approved At', formatDate(project.approvedAt)],
    ['Assigned Leader', project.assignedTeam || 'Not assigned'],
    ['Accepted At', formatDate(project.acceptedAt)],
  ];

  if (project.rejectedReason) {
    details.push(['Rejection Reason', project.rejectedReason]);
  }

  autoTable(doc, {
    startY,
    head: [['Field', 'Value']],
    body: details,
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
  });

  const afterTable = getLastY(doc);
  let y = afterTable + 10;
  if (y > 250) { doc.addPage(); y = 20; }

  if (showBudget) {
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175);
    doc.text('Project Description (from Selling Team):', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const descText = project.description || 'No description provided';
    const descLines = doc.splitTextToSize(descText, pageWidth - 30);
    const descHeight = descLines.length * 5 + 8;
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, y, pageWidth - 24, descHeight, 2, 2, 'FD');
    doc.text(descLines, 16, y + 6);
    y += descHeight + 5;
  }

  // ===== FIXED: Quotation file section - NO LINK =====
  if (project.quotationFile) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235);
    doc.text('📎 Quotation File: ' + project.quotationFile.name, 14, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Uploaded: ' + formatDate(project.quotationFile.uploadedAt) + ' | Size: ' + (project.quotationFile.size / 1024).toFixed(1) + ' KB', 14, y);
    
    // Optional: Small indicator that file exists in system
    y += 4;
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(7);
    doc.text('✓ Quotation file available in system - View/Download from dashboard', 14, y);
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    
    y += 8;
  }
  // ==================================================

  doc.setTextColor(0, 0, 0);
  return y;
}

// ============================================
// VIEW SINGLE UPLOADED DOCUMENT (per step file)
// ============================================
export function viewStepDocument(file: { id?: string; name: string; type?: string; data?: string }): void {
  if (!file.id && !file.data) {
    alert('File not available for preview.');
    return;
  }

  const url = file.id ? getFileDownloadUrl(file.id) : file.data!;
  const name = file.name || '';
  const mimeType = file.type || '';

  const ext = name.split('.').pop()?.toLowerCase() || '';
  const isPdf = mimeType.includes('pdf') || ext === 'pdf';
  const isImage = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);

  if (isPdf) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${name}</title>
          <style>
            body { margin: 0; padding: 0; background: #374151; font-family: system-ui, -apple-system, sans-serif; }
            .container { height: 100vh; display: flex; flex-direction: column; }
            .toolbar { background: #1f2937; padding: 12px 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #4b5563; }
            .toolbar h3 { color: white; margin: 0; font-size: 16px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
            .btn-download { background: #10b981; color: white; }
            .btn-close { background: #4b5563; color: white; }
            .btn:hover { opacity: 0.9; }
            iframe { flex: 1; width: 100%; border: none; background: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="toolbar">
              <h3>📄 ${name}</h3>
              <a href="${url}" download class="btn btn-download" target="_blank">📥 Download</a>
              <button class="btn btn-close" onclick="window.close()">✕ Close</button>
            </div>
            <iframe src="${url}" type="application/pdf"></iframe>
          </div>
        </body>
        </html>
      `);
      win.document.close();
    }
  } else if (isImage) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${name}</title>
          <style>
            body { margin: 0; background: #1f2937; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui; }
            .card { max-width: 90%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
            .header { background: #111827; color: white; padding: 15px 20px; display: flex; align-items: center; justify-content: space-between; }
            .header h3 { margin: 0; font-size: 16px; }
            .btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
            .btn-download { background: #10b981; color: white; }
            .btn-close { background: #4b5563; color: white; }
            img { max-width: 100%; max-height: 80vh; display: block; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h3>🖼️ ${name}</h3>
              <div style="display: flex; gap: 8px;">
                <a href="${url}" download class="btn btn-download" target="_blank">📥 Download</a>
                <button class="btn btn-close" onclick="window.close()">✕ Close</button>
              </div>
            </div>
            <img src="${url}" alt="${name}" />
          </div>
        </body>
        </html>
      `);
      win.document.close();
    }
  } else {
    window.open(url, '_blank');
  }
}

// ============================================
// VIEW QUOTATION FILE - UPDATED VERSION
// ============================================
export function viewQuotationFile(project: Project): void {
  if (!project.quotationFile || !project.quotationFile.id) {
    alert('Quotation file not available for preview.');
    return;
  }

  const file = project.quotationFile;
  viewFileInBrowser(file.id, file.name);
}

// ============================================
// ADMIN PDF — Full details WITH budget
// ============================================
export function generateProjectPDF(project: Project): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  addHeader(doc, 'Complete Project Report (Admin)', project);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(project.name, 14, 56);

  let y = addProjectInfoTable(doc, project, 62, true);

  if (project.boq && project.boq.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(88, 28, 135);
    doc.text('Bill of Quantities (BOQ)', 14, y);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: y + 5,
      head: [['#', 'Description', 'Unit', 'Qty', 'Rate (PKR)', 'Amount (PKR)']],
      body: project.boq.map((b, i) => [i + 1, b.description, b.unit, b.quantity, b.rate.toLocaleString(), b.amount.toLocaleString()]),
      foot: [['', '', '', '', 'Grand Total:', 'PKR ' + project.boq.reduce((s, b) => s + b.amount, 0).toLocaleString()]],
      theme: 'striped',
      headStyles: { fillColor: [147, 51, 234], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [233, 213, 255], textColor: [88, 28, 135], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8 },
    });
    y = getLastY(doc) + 8;
  }

  if (project.boqDocuments && project.boqDocuments.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(88, 28, 135);
    doc.text('BOQ Supporting Documents:', 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [['File Name', 'Uploaded By', 'Date', 'Comments', 'Download']],
      body: project.boqDocuments.map(d => [d.name, d.uploadedByName || '-', formatDate(d.uploadedAt), d.comment || '-', d.id ? getFileDownloadUrl(d.id) : '-']),
      theme: 'striped',
      headStyles: { fillColor: [147, 51, 234], fontSize: 8 },
      styles: { fontSize: 7 },
    });
    y = getLastY(doc) + 8;
  }

  doc.addPage();
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('Project Steps — Complete Progress', 14, 18);
  doc.setTextColor(0);

  const totalSteps = project.steps.length;
  const completed = project.steps.filter(s => s.status === 'completed' || s.status === 'approved').length;
  doc.setFontSize(10);
  doc.text('Progress: ' + completed + '/' + totalSteps + ' steps (' + Math.round((completed / totalSteps) * 100) + '%)', 14, 40);

  autoTable(doc, {
    startY: 46,
    head: [['Step', 'Name', 'Type', 'Status', 'Deadline', 'Completed At', 'Delay Reason']],
    body: project.steps.map(s => {
      const dl = s.stepDeadline ? new Date(s.stepDeadline).toLocaleDateString('en-PK') : '-';
      const isLate = s.stepDeadline && !['completed','approved'].includes(s.status) && new Date(s.stepDeadline) < new Date();
      const completedLate = s.stepDeadline && s.completedAt && new Date(s.completedAt) > new Date(s.stepDeadline);
      let statusStr = s.status.toUpperCase();
      if (isLate) statusStr += ' ⚠';
      if (completedLate) statusStr += ' (LATE)';
      return [s.step, (s.type === 'sub' ? '↳ ' : '') + s.name, s.type, statusStr, dl, formatDate(s.completedAt), s.delayReason || '-'];
    }),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 45 }, 2: { cellWidth: 14 }, 3: { cellWidth: 25 }, 4: { cellWidth: 20 }, 5: { cellWidth: 28 }, 6: { cellWidth: 35 } },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section === 'body') {
        const val = String(data.cell.raw);
        if (val.includes('COMPLETED') || val.includes('APPROVED')) { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold'; }
        else if (val.includes('REJECTED') || val.includes('⚠')) { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
        else if (val.includes('IN_PROGRESS')) { data.cell.styles.textColor = [217, 119, 6]; data.cell.styles.fontStyle = 'bold'; }
      }
      if (data.column.index === 6 && data.section === 'body') {
        if (String(data.cell.raw) !== '-') { data.cell.styles.textColor = [180, 83, 9]; }
      }
    },
  });

  let afterSteps = getLastY(doc) + 8;
  for (const s of project.steps) {
    if (!s.files || s.files.length === 0) continue;
    if (afterSteps > 230) { doc.addPage(); afterSteps = 20; }
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 175);
    doc.text('Step ' + s.step + ': ' + s.name, 14, afterSteps);
    afterSteps += 5;
    autoTable(doc, {
      startY: afterSteps,
      head: [['File', 'Size', 'Uploaded', 'Approval', 'Note', 'Link']],
      body: s.files.map(f => [f.name, (f.size / 1024).toFixed(1) + ' KB', formatDate(f.uploadedAt), (f.approvalStatus || 'pending').toUpperCase(), f.approvalNote || '-', f.id ? getFileDownloadUrl(f.id) : '-']),
      theme: 'striped',
      headStyles: { fillColor: [107, 114, 128], fontSize: 7 },
      styles: { fontSize: 7 },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const val = String(data.cell.raw);
          if (val === 'APPROVED') { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold'; }
          else if (val === 'REJECTED') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
        }
      },
    });
    afterSteps = getLastY(doc) + 6;
  }

  if (project.todos && project.todos.length > 0) {
    if (afterSteps > 220) { doc.addPage(); afterSteps = 20; }
    doc.setFontSize(11);
    doc.setTextColor(88, 28, 135);
    doc.text('To-Do List', 14, afterSteps);
    autoTable(doc, {
      startY: afterSteps + 5,
      head: [['#', 'Task', 'Priority', 'Status', 'Created']],
      body: project.todos.map((t, i) => [i + 1, t.text, t.priority.toUpperCase(), t.completed ? 'Done' : 'Pending', formatDate(t.createdAt)]),
      theme: 'striped',
      headStyles: { fillColor: [147, 51, 234], fontSize: 8 },
      styles: { fontSize: 8 },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150);
    const ph = doc.internal.pageSize.getHeight();
    doc.text('Solar Project Tracking — ' + project.name + ' [ADMIN] — Page ' + i + '/' + totalPages, pageWidth / 2, ph - 6, { align: 'center' });
  }
  doc.save(project.name.replace(/\s+/g, '_') + '_Admin_Report.pdf');
}

// ============================================
// PLANNING TEAM PDF — Budget HIDDEN
// ============================================
export function generatePlanningPDF(project: Project): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  addHeader(doc, 'Planning Team Report', project);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(project.name, 14, 56);

  const daysLeft = Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  // Project info — NO budget/price for planning
  autoTable(doc, {
    startY: 62,
    head: [['Field', 'Value']],
    body: [
      ['Site Name', project.name],
      ['Location', project.location],
      ['City', project.city],
      ['Capacity', project.capacity],
      ['Project Type', project.projectType],
      ['Work Order', project.workOrderNumber || '-'],
      ['Deadline', formatDateOnly(project.deadline)],
      ['Deadline Status', daysLeft < 0 ? '⚠ ' + Math.abs(daysLeft) + ' DAYS OVERDUE' : daysLeft + ' days remaining'],
      ['Assigned Leader', project.assignedTeam || 'Not assigned'],
      ['Accepted At', formatDate(project.acceptedAt)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
  });

  let y = getLastY(doc) + 10;

  // Steps with timeline, delay, and approved files
  if (project.steps && project.steps.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(59, 130, 246);
    doc.text('Steps Timeline & Progress', 14, y);
    doc.setTextColor(0);

    const stepRows = project.steps.map(s => {
      const isCompleted = s.status === 'completed' || s.status === 'approved';
      const dl = s.stepDeadline ? new Date(s.stepDeadline) : null;
      const dlDaysLeft = dl ? Math.ceil((dl.getTime() - Date.now()) / 86400000) : null;
      const isLate = dl && !isCompleted && dlDaysLeft !== null && dlDaysLeft < 0;
      const completedLate = dl && isCompleted && s.completedAt && new Date(s.completedAt) > dl;
      const prefix = s.type === 'sub' ? '  ↳ ' : '';

      let statusStr = s.status.toUpperCase();
      if (isLate) statusStr += ' ⚠ LATE';
      if (completedLate) statusStr += ' (LATE)';

      const dlStr = dl ? dl.toLocaleDateString('en-PK') : '-';
      const delayStr = s.delayReason ? s.delayReason.substring(0, 40) : '-';

      return [
        s.step,
        prefix + s.name,
        statusStr,
        dlStr,
        formatDate(s.completedAt),
        delayStr,
      ];
    });

    autoTable(doc, {
      startY: y + 5,
      head: [['#', 'Step Name', 'Status', 'Deadline', 'Completed', 'Delay Reason']],
      body: stepRows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 28 },
        5: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === 'body') {
          const val = String(data.cell.raw);
          if (val.includes('COMPLETED') || val.includes('APPROVED')) { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold'; }
          else if (val.includes('LATE') || val.includes('REJECTED')) { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
          else if (val.includes('IN_PROGRESS')) { data.cell.styles.textColor = [217, 119, 6]; }
          else { data.cell.styles.textColor = [100, 116, 139]; }
        }
        if (data.column.index === 5 && data.section === 'body') {
          const val = String(data.cell.raw);
          if (val !== '-') { data.cell.styles.textColor = [180, 83, 9]; }
        }
      },
    });
    y = getLastY(doc) + 10;
  }

  // Approved files list
  const approvedFiles = project.steps.flatMap(s =>
    (s.files || []).filter(f => f.approvalStatus === 'approved').map(f => ({
      step: s.step, stepName: s.name, fileName: f.name,
      uploadedAt: f.uploadedAt, approvedAt: f.approvedAt || '',
    }))
  );

  if (approvedFiles.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74);
    doc.text('Approved Documents', 14, y);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: y + 5,
      head: [['Step', 'Step Name', 'File Name', 'Uploaded', 'Approved At']],
      body: approvedFiles.map(f => [f.step, f.stepName, f.fileName, formatDate(f.uploadedAt), formatDate(f.approvedAt)]),
      theme: 'striped',
      headStyles: { fillColor: [22, 163, 74], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: { 2: { cellWidth: 55 } },
    });
    y = getLastY(doc) + 10;
  }

  // Delay summary
  const delayedSteps = project.steps.filter(s => s.delayReason);
  if (delayedSteps.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(217, 119, 6);
    doc.text('Delay Report', 14, y);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: y + 5,
      head: [['Step', 'Step Name', 'Deadline', 'Delay Reason']],
      body: delayedSteps.map(s => [
        s.step, s.name,
        s.stepDeadline ? new Date(s.stepDeadline).toLocaleDateString('en-PK') : '-',
        s.delayReason || '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [217, 119, 6], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: { 3: { cellWidth: 80 } },
    });
    y = getLastY(doc) + 10;
  }

  const totalSteps = project.steps.length;
  const completedSteps = project.steps.filter(s => s.status === 'completed' || s.status === 'approved').length;
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150);
    const ph = doc.internal.pageSize.getHeight();
    doc.text('Solar Project Tracking — ' + project.name + ' [PLANNING] — Progress: ' + completedSteps + '/' + totalSteps + ' — Page ' + i + '/' + totalPages, pageWidth / 2, ph - 6, { align: 'center' });
  }
  doc.save(project.name.replace(/\s+/g, '_') + '_Planning_Report.pdf');
}

// ============================================
// VIEW PDF IN BROWSER
// ============================================
export function viewProjectPDF(project: Project): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  addHeader(doc, 'Project Report — View', project);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(project.name, 14, 56);

  let y = addProjectInfoTable(doc, project, 62, true);

  if (project.boq && project.boq.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(88, 28, 135);
    doc.text('BOQ Summary', 14, y);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: y + 5,
      head: [['#', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']],
      body: project.boq.map((b, i) => [i + 1, b.description, b.unit, b.quantity, 'PKR ' + b.rate.toLocaleString(), 'PKR ' + b.amount.toLocaleString()]),
      foot: [['', '', '', '', 'Total:', 'PKR ' + project.boq.reduce((s, b) => s + b.amount, 0).toLocaleString()]],
      theme: 'striped',
      headStyles: { fillColor: [147, 51, 234], fontSize: 8 },
      footStyles: { fillColor: [233, 213, 255], textColor: [88, 28, 135], fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });
    y = getLastY(doc) + 8;
  }

  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFillColor(59, 130, 246);
  doc.rect(0, y - 2, pageWidth, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text('Steps Progress', 14, y + 8);
  doc.setTextColor(0);

  const totalSteps = project.steps.length;
  const completed = project.steps.filter(s => s.status === 'completed' || s.status === 'approved').length;
  autoTable(doc, {
    startY: y + 16,
    head: [['Step', 'Name', 'Status', 'Files', 'Completed']],
    body: project.steps.map(s => [s.step, s.name, s.status.toUpperCase(), s.files?.length || 0, formatDate(s.completedAt)]),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    styles: { fontSize: 9 },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section === 'body') {
        const val = String(data.cell.raw);
        if (val === 'COMPLETED' || val === 'APPROVED') { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold'; }
        else if (val === 'REJECTED') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
        else if (val === 'IN_PROGRESS') { data.cell.styles.textColor = [217, 119, 6]; data.cell.styles.fontStyle = 'bold'; }
      }
    },
  });

  doc.setFontSize(9); doc.setTextColor(100);
  const ph2 = doc.internal.pageSize.getHeight();
  doc.text('Progress: ' + completed + '/' + totalSteps + ' (' + Math.round((completed / totalSteps) * 100) + '%) | ' + project.name, pageWidth / 2, ph2 - 6, { align: 'center' });

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}

// ============================================
// ALL PROJECTS EXCEL
// ============================================
export function generateAllProjectsExcel(projects: Project[]): void {
  const headers = ['Work Order', 'Project Name', 'Location', 'City', 'Budget (PKR)', 'Capacity', 'Type', 'Deadline', 'Status', 'Progress', 'Leader', 'Created', 'Approved', 'Description'];
  const rows = projects.map(p => {
    const done = p.steps.filter(s => s.status === 'completed' || s.status === 'approved').length;
    const total = p.steps.length;
    return [p.workOrderNumber || '-', '"' + p.name + '"', '"' + p.location + '"', '"' + p.city + '"',
      p.budget.toString(), p.capacity, p.projectType, formatDateOnly(p.deadline),
      p.status.replace('_', ' ').toUpperCase(), done + '/' + total + ' (' + Math.round((done / total) * 100) + '%)',
      p.assignedTeam || '-', formatDateOnly(p.createdAt), formatDateOnly(p.approvedAt),
      '"' + (p.description || '').replace(/"/g, "'") + '"'].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'Solar_Projects_' + new Date().toISOString().split('T')[0] + '.csv';
  link.click(); URL.revokeObjectURL(url);
}

// ============================================
// ALL PROJECTS PROGRESS PDF
// ============================================
export function generateProgressPDF(projects: Project[]): void {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('All Projects Progress Report', 14, 18);
  doc.setFontSize(9);
  doc.text('Generated: ' + new Date().toLocaleString('en-PK'), pageWidth - 14, 18, { align: 'right' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 36,
    head: [['#', 'WO#', 'Project', 'City', 'Budget', 'Capacity', 'Deadline', 'Days', 'Status', 'Progress', 'Leader']],
    body: projects.map((p, i) => {
      const done = p.steps.filter(s => s.status === 'completed' || s.status === 'approved').length;
      const total = p.steps.length;
      const daysLeft = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return [i + 1, p.workOrderNumber || '-', p.name, p.city, 'PKR ' + p.budget.toLocaleString(), p.capacity,
        formatDateOnly(p.deadline), daysLeft < 0 ? Math.abs(daysLeft) + 'd OVR' : daysLeft + 'd',
        p.status.replace('_', ' ').toUpperCase(), done + '/' + total + ' (' + Math.round((done / total) * 100) + '%)', p.assignedTeam || '-'];
    }),
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11], fontSize: 7, fontStyle: 'bold' },
    styles: { fontSize: 7 },
    didParseCell: (data) => {
      if (data.column.index === 7 && data.section === 'body' && String(data.cell.raw).includes('OVR')) {
        data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.index === 8 && data.section === 'body' && String(data.cell.raw) === 'COMPLETED') {
        data.cell.styles.textColor = [22, 163, 74];
      }
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text('Solar Project Tracking — Page ' + i + '/' + totalPages, pageWidth / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
  }
  doc.save('All_Projects_' + new Date().toISOString().split('T')[0] + '.pdf');
}