import { Group, Button, Text, Box, Select } from '@mantine/core';
import type { Dispatch, SetStateAction } from 'react';
import { IconFileText, IconFileTypePdf, IconFileWord, IconMarkdown } from '@tabler/icons-react';
import { useState } from 'react';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
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

  let out = `---\ntitle: ${(artifact.sections.title?.content ?? artifact.baseIdea).slice(0, 120)}\ninventors: ${inventorNames}\ndomain: ${artifact.baseDomain}\nmodel: ${artifact.model}\ndate: ${date}\n---\n\n`;

  // Filing info + inventor block
  if (artifact.idfNumber || artifact.businessGroup || artifact.inventors.length > 0) {
    out += `## Filing Details\n\n`;
    if (artifact.idfNumber) out += `**IDF Number:** ${artifact.idfNumber}  \n`;
    if (artifact.businessGroup) out += `**Business Group:** ${artifact.businessGroup}  \n`;
    if (artifact.idfNumber || artifact.businessGroup) out += '\n';
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
      const heading = moduleId === 'idea_analysis' ? 'Invention Framing' : SECTION_LABELS[moduleId];
      out += `## ${heading}\n\n${section.content}\n\n`;
    }
  }
  return out;
}

function buildText(artifact: PatentArtifact): string {
  const sep = '─'.repeat(60);
  const date = new Date().toISOString().split('T')[0];

  let out = `PATENT APPLICATION DRAFT\n`;
  out += `Date: ${date}\n`;
  out += `Model: ${artifact.model}\n`;
  out += `Domain: ${artifact.baseDomain}\n`;
  out += `${sep}\n`;

  if (artifact.idfNumber || artifact.businessGroup || artifact.inventors.length > 0) {
    out += `\n\nFILING DETAILS\n${sep}\n\n${inventorBlock(artifact)}\n`;
  }

  for (const moduleId of WORKFLOW_ORDER) {
    const section = artifact.sections[moduleId];
    if (section) {
      const heading =
        moduleId === 'idea_analysis' ? 'INVENTION FRAMING' : SECTION_LABELS[moduleId].toUpperCase();
      out += `\n\n${heading}\n${sep}\n\n${section.content}\n`;
    }
  }
  return out;
}

function buildPDFHTML(artifact: PatentArtifact): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const titleContent = artifact.sections.title?.content ?? artifact.baseIdea;

  const inventorRows = artifact.inventors
    .map(
      (inv) =>
        `<tr>
          <td><strong>${inv.name}</strong>${inv.citizenship ? ` · ${inv.citizenship}` : ''}</td>
          <td>${inv.telephone ?? ''}${inv.email ? `<br/>${inv.email}` : ''}</td>
          <td>${inv.address ?? ''}</td>
          <td>${inv.employeeId ?? ''}</td>
        </tr>`
    )
    .join('');

  const sections = WORKFLOW_ORDER.filter((m) => artifact.sections[m] && m !== 'idea_analysis')
    .map((moduleId) => {
      const content = artifact.sections[moduleId]!.content;
      const label = SECTION_LABELS[moduleId];
      return `<section>
        <h2>${label}</h2>
        <p>${content.replaceAll('\n', '<br/>')}</p>
      </section>`;
    })
    .join('\n');

  const idfRow = artifact.idfNumber
    ? `<tr><th>IDF Number</th><td>${artifact.idfNumber}</td></tr>`
    : '';
  const bgRow = artifact.businessGroup
    ? `<tr><th>Business Group</th><td>${artifact.businessGroup}</td></tr>`
    : '';
  const filingBlock = artifact.idfNumber || artifact.businessGroup
    ? `<h2>Filing Info</h2><table>${idfRow}${bgRow}</table>`
    : '';
  const inventorsBlock = artifact.inventors.length > 0
    ? `<h2>Inventors</h2><table><tr><th>Name / Citizenship</th><th>Telephone / Email</th><th>Address</th><th>Employee ID</th></tr>${inventorRows}</table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${titleContent.slice(0, 80)}</title>
<style>
  @page { margin: 1in; size: letter; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 0; color: #000; line-height: 1.6; }
  h1 { font-size: 20pt; font-weight: bold; text-align: center; margin: 0 0 6pt 0; }
  h2 { font-size: 13pt; font-weight: bold; margin: 28pt 0 6pt 0; border-bottom: 1.5px solid #333; padding-bottom: 4pt; }
  p { line-height: 1.8; text-align: justify; margin: 0 0 10pt 0; }
  .meta { font-size: 10pt; color: #555; text-align: center; margin-bottom: 28pt; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0 18pt 0; font-size: 11pt; }
  th { background: #f0f0f0; border: 1px solid #bbb; padding: 6px 10px; text-align: left; font-weight: bold; }
  td { border: 1px solid #bbb; padding: 6px 10px; vertical-align: top; }
  section { margin-bottom: 0; }
  @media print {
    h2 { page-break-after: avoid; }
    section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${titleContent}</h1>
  <p class="meta">Patent Application Draft &nbsp;·&nbsp; ${date} &nbsp;·&nbsp; ${artifact.model.split(':')[0]}</p>

  ${filingBlock}

  ${inventorsBlock}

  ${sections}
</body>
</html>`;
}

async function buildDocx(artifact: PatentArtifact): Promise<Blob> {
  const date = new Date().toLocaleDateString('en-US');
  const titleContent = artifact.sections.title?.content ?? artifact.baseIdea;

  const children: Paragraph[] = [];

  // Title + meta
  children.push(
    new Paragraph({
      text: titleContent,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Patent Application Draft  ·  ${date}  ·  ${artifact.model.split(':')[0]}`, size: 20, color: '666666' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Inventors
  if (artifact.inventors.length > 0) {
    children.push(
      new Paragraph({
        text: 'Inventors',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } },
      })
    );
    artifact.inventors.forEach((inv) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: inv.name, bold: true, size: 24 })],
          spacing: { after: 60 },
        })
      );
      if (inv.address)
        children.push(new Paragraph({ children: [new TextRun({ text: `Address: ${inv.address}`, size: 20 })], spacing: { after: 40 } }));
      if (inv.email)
        children.push(new Paragraph({ children: [new TextRun({ text: `Email: ${inv.email}`, size: 20 })], spacing: { after: 40 } }));
      if (inv.citizenship)
        children.push(new Paragraph({ children: [new TextRun({ text: `Citizenship: ${inv.citizenship}`, size: 20 })], spacing: { after: 40 } }));
      if (inv.employeeId)
        children.push(new Paragraph({ children: [new TextRun({ text: `Employee ID: ${inv.employeeId}`, size: 20 })], spacing: { after: 120 } }));
    });
  }

  // Sections
  for (const moduleId of WORKFLOW_ORDER) {
    const section = artifact.sections[moduleId];
    if (!section || moduleId === 'idea_analysis') continue;

    const label = SECTION_LABELS[moduleId];
    children.push(
      new Paragraph({
        text: label,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } }
      })
    );

    // Split on double newlines to get paragraphs
    const paragraphs = section.content.split(/\n{2,}/);
    for (const para of paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: para.trim(), size: 24 })],
          spacing: { after: 160 },
          alignment: AlignmentType.JUSTIFIED
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { font: 'Times New Roman', size: 24 }
        },
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
    const stem = `patent-draft-${date}`;

    try {
      if (format === 'md') {
        downloadFile(buildMarkdown(artifact), `${stem}.md`, 'text/markdown');
      } else if (format === 'txt') {
        downloadFile(buildText(artifact), `${stem}.txt`, 'text/plain');
      } else if (format === 'pdf') {
        const html = buildPDFHTML(artifact);
        const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank');
        if (win) {
          win.addEventListener('load', () => {
            setTimeout(() => {
              win.print();
              URL.revokeObjectURL(blobUrl);
            }, 300);
          });
        }
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
