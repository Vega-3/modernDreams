/**
 * Client-side file parsers for bulk dream import.
 * Supports .txt, .md/.markdown, .docx, .pdf — all processed in-browser,
 * no server or external API required.
 */

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import type { Tag } from './tauri';

// Point pdfjs at its own worker file (Vite resolves this at build time).
// The ?url suffix tells Vite to emit the file and return its URL string.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite ?url import
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ── Public types ──────────────────────────────────────────────────────────────

export interface ParsedFile {
  filename: string;
  title: string;
  date: string;
  contentHtml: string;
  contentPlain: string;
  matchedTagIds: string[];
  /** Set when parsing failed — the other fields will be empty defaults. */
  error?: string;
}

// ── Tag matching ──────────────────────────────────────────────────────────────

/**
 * Return IDs of tags whose name or any alias appears as a whole word in content.
 * Case-insensitive, Unicode word-boundary aware (checks surrounding \W chars).
 */
export function matchTagsToContent(contentPlain: string, tags: Tag[]): string[] {
  const lower = contentPlain.toLowerCase();
  return tags
    .filter(tag => {
      const terms = [tag.name, ...(tag.aliases ?? [])];
      return terms.some(term => {
        const t = term.toLowerCase();
        let idx = lower.indexOf(t);
        while (idx !== -1) {
          const before = idx === 0 || /\W/.test(lower[idx - 1]);
          const after  = idx + t.length >= lower.length || /\W/.test(lower[idx + t.length]);
          if (before && after) return true;
          idx = lower.indexOf(t, idx + 1);
        }
        return false;
      });
    })
    .map(tag => tag.id);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function filenameToTitle(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function plainToHtml(text: string): string {
  return `<p>${text.trim().replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

// ── .txt ─────────────────────────────────────────────────────────────────────

function parseTxt(filename: string, text: string) {
  const lines = text.split(/\r?\n/);
  const dateMatch = lines[0].match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : todayIso();
  const body = (dateMatch ? lines.slice(1).join('\n') : text).trim();
  return { title: filenameToTitle(filename), date, contentPlain: body, contentHtml: plainToHtml(body) };
}

// ── .md ──────────────────────────────────────────────────────────────────────

function parseMd(filename: string, text: string) {
  let src = text.trim();
  let title = filenameToTitle(filename);
  let date  = todayIso();

  // Strip YAML frontmatter and read title/date from it
  if (src.startsWith('---')) {
    const end = src.indexOf('\n---', 3);
    if (end !== -1) {
      const fm = src.slice(3, end);
      const t  = fm.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
      const d  = fm.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
      if (t) title = t[1].trim();
      if (d) date  = d[1];
      src = src.slice(end + 4).trim();
    }
  }

  // Fall back to first H1 for the title
  const h1 = src.match(/^#\s+(.+)/m);
  if (h1 && title === filenameToTitle(filename)) title = h1[1].trim();

  const contentHtml  = mdToHtml(src);
  const contentPlain = src
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g,     '$1')
    .replace(/_(.+?)_/g,       '$1')
    .replace(/^[-*+]\s+/gm,    '')
    .trim();

  return { title, date, contentHtml, contentPlain };
}

/** Minimal Markdown → TipTap-compatible HTML (headings, bold, italic, lists, paragraphs). */
function mdToHtml(md: string): string {
  const lines = md.split('\n');
  const raw: string[] = [];
  let inList = false;

  for (const line of lines) {
    const styled = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/_(.+?)_/g,       '<em>$1</em>');

    if      (/^###\s/.test(line)) { if (inList) { raw.push('</ul>'); inList = false; } raw.push(`<h3>${styled.replace(/^###\s/, '')}</h3>`); }
    else if (/^##\s/.test(line))  { if (inList) { raw.push('</ul>'); inList = false; } raw.push(`<h2>${styled.replace(/^##\s/,  '')}</h2>`); }
    else if (/^#\s/.test(line))   { if (inList) { raw.push('</ul>'); inList = false; } raw.push(`<h1>${styled.replace(/^#\s/,   '')}</h1>`); }
    else if (/^[-*+]\s/.test(line)) {
      if (!inList) { raw.push('<ul>'); inList = true; }
      raw.push(`<li>${styled.replace(/^[-*+]\s/, '')}</li>`);
    } else if (line.trim() === '') {
      if (inList) { raw.push('</ul>'); inList = false; }
      raw.push('');
    } else {
      if (inList) { raw.push('</ul>'); inList = false; }
      raw.push(styled);
    }
  }
  if (inList) raw.push('</ul>');

  // Group consecutive prose lines into <p> blocks
  const blocks: string[] = [];
  let para: string[] = [];
  for (const line of raw) {
    if (line === '' || /^<(h[1-6]|ul|li|\/ul)/.test(line)) {
      if (para.length) { blocks.push(`<p>${para.join('<br>')}</p>`); para = []; }
      if (line !== '') blocks.push(line);
    } else {
      para.push(line);
    }
  }
  if (para.length) blocks.push(`<p>${para.join('<br>')}</p>`);
  return blocks.join('\n');
}

// ── .docx ─────────────────────────────────────────────────────────────────────

async function parseDocx(filename: string, buffer: ArrayBuffer) {
  const { value: contentHtml } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const contentPlain = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const dateMatch    = contentPlain.match(/(\d{4}-\d{2}-\d{2})/);
  return {
    title:        filenameToTitle(filename),
    date:         dateMatch ? dateMatch[1] : todayIso(),
    contentHtml,
    contentPlain,
  };
}

// ── .pdf ──────────────────────────────────────────────────────────────────────

async function parsePdf(filename: string, buffer: ArrayBuffer) {
  const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parts.push(content.items.map((item: any) => item.str ?? '').join(' '));
  }

  const contentPlain = parts.join('\n\n').trim();
  const dateMatch    = contentPlain.match(/(\d{4}-\d{2}-\d{2})/);
  return {
    title:        filenameToTitle(filename),
    date:         dateMatch ? dateMatch[1] : todayIso(),
    contentPlain,
    contentHtml:  plainToHtml(contentPlain),
  };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Parse a single File object into a dream-ready struct with pre-matched tag IDs.
 * Returns an error-flagged result rather than throwing so the caller can
 * show per-file errors without aborting the whole batch.
 */
export async function parseFile(file: File, tags: Tag[]): Promise<ParsedFile> {
  try {
    const buffer = await file.arrayBuffer();
    const ext    = file.name.split('.').pop()?.toLowerCase() ?? '';

    let parsed: Omit<ParsedFile, 'matchedTagIds' | 'filename' | 'error'>;

    if (ext === 'txt') {
      parsed = parseTxt(file.name, new TextDecoder().decode(buffer));
    } else if (ext === 'md' || ext === 'markdown') {
      parsed = parseMd(file.name, new TextDecoder().decode(buffer));
    } else if (ext === 'docx') {
      parsed = await parseDocx(file.name, buffer);
    } else if (ext === 'pdf') {
      parsed = await parsePdf(file.name, buffer);
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }

    return {
      filename: file.name,
      ...parsed,
      matchedTagIds: matchTagsToContent(parsed.contentPlain, tags),
    };
  } catch (err) {
    return {
      filename:     file.name,
      title:        filenameToTitle(file.name),
      date:         todayIso(),
      contentHtml:  '',
      contentPlain: '',
      matchedTagIds: [],
      error:        String(err),
    };
  }
}
