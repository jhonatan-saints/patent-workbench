import { Group, Button, Text, Box, Select } from '@mantine/core';
import type { Dispatch, SetStateAction } from 'react';
import { IconFileText, IconFileTypePdf, IconFileWord, IconMarkdown } from '@tabler/icons-react';
import { useState } from 'react';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from 'docx';
import { useWorkbenchStore } from '@/store/workbench';
import { WORKFLOW_ORDER, SECTION_LABELS } from '@/utils/workflowTemplates';
import type { PatentArtifact } from '@/types';

type ExportFormat = 'md' | 'txt' | 'pdf' | 'docx';

// IDF-style formatters
function inventorBlock(artifact: PatentArtifact): string {
  const lines: string[] = [];
  if (artifact.idfNumber) lines.push(`IDF Number: ${artifact.idfNumber}`);
  if (artifact.businessGroup) lines.push(`Business Group: ${artifact.businessGroup}`);
  if (lines.length > 0) lines.push('');
  artifact.inventors.forEach((inv, i) => {
    lines.push(`Inventor ${i + 1}: ${inv.name}`);
    if (inv.address) lines.push(`  Address: ${inv.address}`);
    if (inv.telephone) lines.push(`  Telephone: ${inv.telephone}`);
    if (inv.email) lines.push(`  Email: ${inv.email}`);
    if (inv.citizenship) lines.push(`  Citizenship: ${inv.citizenship}`);
    if (inv.employeeId) lines.push(`  Employee ID: ${inv.employeeId}`);
  });
  return lines.join('\n');
}

function buildMarkdown(artifact: PatentArtifact): string {
  const date = new Date().toISOString().split('T')[0];
  const inventorNames = artifact.inventors.map((i) => i.name).join('; ');
  const titleContent = artifact.inventionTitle ?? artifact.baseIdea;

  let out = `---\ntitle: ${titleContent.slice(0, 120)}\ninventors: ${inventorNames}\ndomain: ${artifact.baseDomain}\nmodel: ${artifact.model}\ndate: ${date}\n---\n\n`;

  // Filing info + inventor block
  if (artifact.idfNumber || artifact.businessGroup || artifact.inventors.length > 0) {
    out += `## Filing Details\n\n`;
    if (artifact.inventionTitle) out += `**Invention Title:** ${artifact.inventionTitle}  \n`;
    if (artifact.idfNumber) out += `**IDF Number:** ${artifact.idfNumber}  \n`;
    if (artifact.businessGroup) out += `**Business Group:** ${artifact.businessGroup}  \n`;
    if (artifact.idfNumber || artifact.businessGroup || artifact.inventionTitle) out += '\n';
    artifact.inventors.forEach((inv) => {
      out += `**${inv.name}**`;
      if (inv.address) out += `  \nAddress: ${inv.address}`;
      if (inv.telephone) out += `  \nTelephone: ${inv.telephone}`;
      if (inv.email) out += `  \nEmail: ${inv.email}`;
      if (inv.citizenship) out += `  \nCitizenship: ${inv.citizenship}`;
      if (inv.employeeId) out += `  \nEmployee ID: ${inv.employeeId}`;
      out += '\n\n';
    });
  }

  for (const moduleId of WORKFLOW_ORDER) {
    const section = artifact.sections[moduleId];
    if (section) {
      out += `## ${SECTION_LABELS[moduleId]}\n\n${section.content}\n\n`;
    }
  }

  if (artifact.figures?.length) {
    out += `## Figures\n\n`;
    artifact.figures.forEach((fig) => {
      const captionSuffix = fig.caption ? ` — ${fig.caption}` : '';
      out += `**${fig.name}**${captionSuffix}\n\n`;
    });
  }

  return out;
}

function buildText(artifact: PatentArtifact): string {
  const sep = '─'.repeat(60);
  const date = new Date().toISOString().split('T')[0];

  let out = `INVENTION DISCLOSURE FORM\n`;
  out += `Date: ${date}\n`;
  out += `Model: ${artifact.model}\n`;
  out += `Domain: ${artifact.baseDomain}\n`;
  out += `${sep}\n`;

  if (artifact.idfNumber || artifact.businessGroup || artifact.inventors.length > 0) {
    out += `\n\nFILING DETAILS\n${sep}\n\n`;
    if (artifact.inventionTitle) out += `Invention Title: ${artifact.inventionTitle}\n`;
    out += inventorBlock(artifact) + '\n';
  }

  for (const moduleId of WORKFLOW_ORDER) {
    const section = artifact.sections[moduleId];
    if (section) {
      out += `\n\n${SECTION_LABELS[moduleId].toUpperCase()}\n${sep}\n\n${section.content}\n`;
    }
  }

  if (artifact.figures?.length) {
    out += `\n\nFIGURES\n${sep}\n\n`;
    artifact.figures.forEach((fig) => {
      const captionSuffix = fig.caption ? ` — ${fig.caption}` : '';
      out += `${fig.name}${captionSuffix}\n`;
    });
  }

  return out;
}

function buildPDFHTML(artifact: PatentArtifact): string {
  const titleContent = artifact.inventionTitle ?? artifact.baseIdea;

  // Inventor fields — blue labels, field-per-line layout matching IDF format
  const inventorsHtml = artifact.inventors
    .map(
      (inv) => `
    <div class="field-label">Name:</div>
    <div class="field-value-bold">${inv.name}</div>
    ${inv.address ? `<div class="field-label">Home Address:</div><div class="field-value">${inv.address}</div>` : ''}
    ${inv.telephone ? `<div class="field-label">Home Telephone:</div><div class="field-value">${inv.telephone}</div>` : ''}
    ${inv.email ? `<div class="field-label">Home Email:</div><div class="field-value">${inv.email}</div>` : '<div class="field-label">Home Email:</div><div class="field-value">&nbsp;</div>'}
    ${inv.citizenship ? `<div class="field-label">Citizenship:</div><div class="field-value">${inv.citizenship}</div>` : ''}
    ${inv.employeeId ? `<div class="field-label">Employee ID:</div><div class="field-value-bold">${inv.employeeId}</div>` : ''}
  `
    )
    .join('');

  const inventorsSection =
    artifact.inventors.length > 0
      ? `<div class="idf-section-label">Inventors</div>${inventorsHtml}`
      : '';

  const inventionTitleBlock = `
    <p class="meta-label">Invention Title</p>
    <p class="field-value">${titleContent}</p>`;

  const idfValueHtml = artifact.idfNumber ? `<p class="field-value">${artifact.idfNumber}</p>` : '';
  const bgHtml = artifact.businessGroup
    ? `<p class="meta-label">Business Group</p><p class="field-value">${artifact.businessGroup}</p>`
    : '';
  const idfMetaBlock = `
    <p class="meta-label">IDF Number</p>
    ${idfValueHtml}
    ${bgHtml}`;

  const sections = WORKFLOW_ORDER.filter((m) => artifact.sections[m])
    .map((moduleId) => {
      const content = artifact.sections[moduleId]!.content;
      const label = SECTION_LABELS[moduleId];
      const paragraphs = content
        .split(/\n{2,}/)
        .map((p) => `<p>${p.trim().replaceAll('\n', '<br/>')}</p>`)
        .join('');
      return `<section><h2>${label}</h2>${paragraphs}</section>`;
    })
    .join('\n');

  const figuresHtml = artifact.figures?.length
    ? `<section>
        <h2>Figures</h2>
        ${artifact.figures.map((fig) => `
          <div style="text-align:center; margin-bottom: 20pt;">
            <img src="${fig.dataUrl}" alt="${fig.name}" style="max-width:100%; border:1px solid #ddd;"/>
            <p style="font-size:10pt; color:#555; font-style:italic; margin-top:4pt;">${fig.name}${fig.caption ? ` — ${fig.caption}` : ''}</p>
          </div>
        `).join('')}
      </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${titleContent.slice(0, 80)}</title>
<style>
  @page { margin: 1in; size: letter; }
  * { box-sizing: border-box; }
  body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; margin: 0; color: #000; line-height: 1.5; }
  .idf-section-label { color: #4472C4; font-size: 14pt; font-weight: normal; margin: 0 0 6pt 0; }
  .field-label { color: #4472C4; font-size: 11pt; font-weight: normal; margin: 10pt 0 1pt 0; }
  .field-value { font-size: 11pt; font-weight: normal; color: #000; margin: 0 0 0 0; }
  .field-value-bold { font-size: 11pt; font-weight: bold; color: #000; margin: 0 0 0 0; }
  .meta-label { font-size: 11pt; font-weight: bold; color: #000; margin: 12pt 0 1pt 0; }
  h2 { font-size: 11pt; font-weight: bold; color: #000; margin: 16pt 0 4pt 0; }
  p { line-height: 1.5; text-align: justify; margin: 0 0 6pt 0; }
  section { margin-bottom: 4pt; }
  @media print {
    h2 { page-break-after: avoid; }
    section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  ${inventorsSection}

  ${inventionTitleBlock}

  ${idfMetaBlock}

  ${sections}

  ${figuresHtml}
</body>
</html>`;
}

async function buildDocx(artifact: PatentArtifact): Promise<Blob> {
  const titleContent = artifact.inventionTitle ?? artifact.baseIdea;
  const BLUE = '4472C4';
  const fieldSize = 22; // 11pt

  const children: Paragraph[] = [];

  // Inventors section — blue labels, field-per-line layout matching IDF format
  if (artifact.inventors.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Inventors', color: BLUE, size: 28, font: 'Calibri' })],
        spacing: { after: 80 },
      })
    );
    artifact.inventors.forEach((inv) => {
      children.push(
        new Paragraph({ children: [new TextRun({ text: 'Name:', color: BLUE, size: fieldSize, font: 'Calibri' })], spacing: { before: 180, after: 40 } }),
        new Paragraph({ children: [new TextRun({ text: inv.name, bold: true, size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } })
      );
      if (inv.address) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: 'Home Address:', color: BLUE, size: fieldSize, font: 'Calibri' })], spacing: { before: 180, after: 40 } }),
          new Paragraph({ children: [new TextRun({ text: inv.address, size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } })
        );
      }
      if (inv.telephone) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: 'Home Telephone:', color: BLUE, size: fieldSize, font: 'Calibri' })], spacing: { before: 180, after: 40 } }),
          new Paragraph({ children: [new TextRun({ text: inv.telephone, size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } })
        );
      }
      children.push(
        new Paragraph({ children: [new TextRun({ text: 'Home Email:', color: BLUE, size: fieldSize, font: 'Calibri' })], spacing: { before: 180, after: 40 } }),
        new Paragraph({ children: [new TextRun({ text: inv.email ?? '', size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } })
      );
      if (inv.citizenship) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: 'Citizenship:', color: BLUE, size: fieldSize, font: 'Calibri' })], spacing: { before: 180, after: 40 } }),
          new Paragraph({ children: [new TextRun({ text: inv.citizenship, size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } })
        );
      }
      if (inv.employeeId) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: 'Employee ID:', color: BLUE, size: fieldSize, font: 'Calibri' })], spacing: { before: 180, after: 40 } }),
          new Paragraph({ children: [new TextRun({ text: inv.employeeId, bold: true, size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } })
        );
      }
    });
  }

  // Invention title + IDF metadata — bold black labels
  children.push(
    new Paragraph({ children: [new TextRun({ text: 'Invention Title', bold: true, size: fieldSize, font: 'Calibri' })], spacing: { before: 240, after: 40 } }),
    new Paragraph({ children: [new TextRun({ text: titleContent, size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } }),
    new Paragraph({ children: [new TextRun({ text: 'IDF Number', bold: true, size: fieldSize, font: 'Calibri' })], spacing: { before: 180, after: 40 } })
  );
  if (artifact.idfNumber) {
    children.push(new Paragraph({ children: [new TextRun({ text: artifact.idfNumber, size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } }));
  }
  if (artifact.businessGroup) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'Business Group', bold: true, size: fieldSize, font: 'Calibri' })], spacing: { before: 180, after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: artifact.businessGroup, size: fieldSize, font: 'Calibri' })], spacing: { after: 0 } })
    );
  }

  // Content sections — bold black headings
  for (const moduleId of WORKFLOW_ORDER) {
    const section = artifact.sections[moduleId];
    if (!section) continue;

    const label = SECTION_LABELS[moduleId];
    children.push(
      new Paragraph({
        children: [new TextRun({ text: label, bold: true, size: fieldSize, font: 'Calibri' })],
        spacing: { before: 320, after: 100 },
      })
    );

    for (const para of section.content.split(/\n{2,}/)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: para.trim(), size: fieldSize, font: 'Calibri' })],
          spacing: { after: 120 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    }
  }

  // Figures section — captions only (images are embedded in PDF export)
  if (artifact.figures?.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Figures', bold: true, size: fieldSize, font: 'Calibri' })],
        spacing: { before: 320, after: 100 },
      })
    );
    artifact.figures.forEach((fig) => {
      const captionSuffix = fig.caption ? ` — ${fig.caption}` : '';
      children.push(
        new Paragraph({
          children: [new TextRun({
            text: `${fig.name}${captionSuffix}`,
            size: fieldSize,
            font: 'Calibri',
            italics: true,
          })],
          spacing: { after: 80 },
        })
      );
    });
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', run: { font: 'Calibri', size: fieldSize } },
      ],
    },
  });

  return Packer.toBlob(doc);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatIcon(format: ExportFormat) {
  if (format === 'pdf') return <IconFileTypePdf size={13} />;
  if (format === 'docx') return <IconFileWord size={13} />;
  if (format === 'md') return <IconMarkdown size={13} />;
  return <IconFileText size={13} />;
}

export function ExportPanel({
  zoom,
  setZoom,
}: Readonly<{
  zoom?: number;
  setZoom?: Dispatch<SetStateAction<number>>;
}>) {
  const { artifact, saveCurrentSession } = useWorkbenchStore();
  const [format, setFormat] = useState<ExportFormat>('docx');
  const [exporting, setExporting] = useState(false);

  // Available from any phase as long as artifact exists and has at least one section
  const hasSections = artifact && Object.keys(artifact.sections).length > 0;
  if (!hasSections) return null;

  const handleExport = async () => {
    if (!artifact) return;
    setExporting(true);
    saveCurrentSession();
    const date = new Date().toISOString().split('T')[0];
    const stem = `idf-draft-${date}`;

    try {
      if (format === 'md') {
        downloadFile(buildMarkdown(artifact), `${stem}.md`, 'text/markdown');
      } else if (format === 'txt') {
        downloadFile(buildText(artifact), `${stem}.txt`, 'text/plain');
      } else if (format === 'pdf') {
        const html = buildPDFHTML(artifact);
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Patent IDF Print');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;visibility:hidden;';
        iframe.srcdoc = html;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow?.print();
            iframe.remove();
          }, 300);
        };
      } else if (format === 'docx') {
        const blob = await buildDocx(artifact);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${stem}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box
      style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-raised)',
        flexShrink: 0,
      }}
    >
      <Group gap={8} justify="flex-end">
        {typeof zoom === 'number' && setZoom && (
          <Group gap={4} style={{ flexShrink: 0, marginRight: 16 }}>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => setZoom((z) => Math.max(0.5, Number.parseFloat((z - 0.1).toFixed(1))))}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 28, padding: '0 6px' }}
            >
              −
            </Button>
            <Text size="xs" ff="monospace" style={{ color: 'var(--text-muted)', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Text>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => setZoom((z) => Math.min(1.5, Number.parseFloat((z + 0.1).toFixed(1))))}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 28, padding: '0 6px' }}
            >
              +
            </Button>
          </Group>
        )}
        <Text size="xs" c="var(--text-muted)" ff="monospace">
          Export:
        </Text>
        <Select
          size="xs"
          value={format}
          onChange={(v) => v && setFormat(v as ExportFormat)}
          data={[
            { value: 'docx', label: '.docx' },
            { value: 'pdf', label: '.pdf' },
            { value: 'txt', label: '.txt' }
          ]}
          style={{ width: 90 }}
          styles={{
            input: {
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              height: 28,
              minHeight: 28
            },
            dropdown: {
              background: 'var(--surface)',
              border: '1px solid var(--border)'
            },
          }}
        />
        <Button
          size="xs"
          variant="outline"
          leftSection={formatIcon(format)}
          onClick={() => void handleExport()}
          loading={exporting}
          style={{
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            height: 28
          }}
        >
          DOWNLOAD
        </Button>
      </Group>
    </Box>
  );
}
