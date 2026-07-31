import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

const renderer = new Renderer();
const defaultCode = renderer.code.bind(renderer);

renderer.code = ({ text, lang, escaped }) => {
  const language = (lang || '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (language === 'mermaid') {
    const body = escaped ? text : text;
    return `<pre class="md-mermaid-source"><code class="language-mermaid">${
      escaped ? body : escapeHtml(body)
    }</code></pre>\n`;
  }
  return defaultCode({ text, lang, escaped });
};

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Colorful LogStudio-aligned Mermaid palettes for light/dark. */
export function getMermaidThemeVariables(theme: 'dark' | 'light'): Record<string, string | boolean | number> {
  if (theme === 'light') {
    return {
      darkMode: false,
      background: '#ffffff',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      primaryColor: '#a8d4ff',
      primaryTextColor: '#0b1f33',
      primaryBorderColor: '#218bff',
      secondaryColor: '#b7f0c4',
      secondaryTextColor: '#0d3318',
      secondaryBorderColor: '#1a7f37',
      tertiaryColor: '#e2d4ff',
      tertiaryTextColor: '#2a1659',
      tertiaryBorderColor: '#8250df',
      lineColor: '#424a53',
      textColor: '#1f2328',
      mainBkg: '#a8d4ff',
      nodeBkg: '#a8d4ff',
      nodeBorder: '#218bff',
      clusterBkg: '#fff6e0',
      clusterBorder: '#bf8700',
      titleColor: '#1f2328',
      edgeLabelBackground: '#ffffff',
      // Sequence diagram
      actorBkg: '#ffd8a8',
      actorBorder: '#bc4c00',
      actorTextColor: '#1f2328',
      actorLineColor: '#57606a',
      signalColor: '#1f2328',
      signalTextColor: '#1f2328',
      labelBoxBkgColor: '#d4f4dd',
      labelBoxBorderColor: '#1a7f37',
      labelTextColor: '#1f2328',
      loopTextColor: '#1f2328',
      noteBkgColor: '#fff8c5',
      noteTextColor: '#1f2328',
      noteBorderColor: '#bf8700',
      activationBkgColor: '#ffe8a3',
      activationBorderColor: '#9a6700',
      sequenceNumberColor: '#ffffff',
      labelColor: '#1f2328',
      altBackground: '#f6f8fa',
    };
  }

  return {
    darkMode: true,
    background: '#0d1117',
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    primaryColor: '#1f6feb',
    primaryTextColor: '#f0f6fc',
    primaryBorderColor: '#58a6ff',
    secondaryColor: '#238636',
    secondaryTextColor: '#f0f6fc',
    secondaryBorderColor: '#3fb950',
    tertiaryColor: '#8957e5',
    tertiaryTextColor: '#f0f6fc',
    tertiaryBorderColor: '#a371f7',
    lineColor: '#8b949e',
    textColor: '#e6edf3',
    mainBkg: '#1f6feb',
    nodeBkg: '#1f6feb',
    nodeBorder: '#58a6ff',
    clusterBkg: '#21262d',
    clusterBorder: '#d29922',
    titleColor: '#e6edf3',
    edgeLabelBackground: '#161b22',
    actorBkg: '#9e6a03',
    actorBorder: '#d29922',
    actorTextColor: '#f0f6fc',
    actorLineColor: '#6e7681',
    signalColor: '#e6edf3',
    signalTextColor: '#e6edf3',
    labelBoxBkgColor: '#238636',
    labelBoxBorderColor: '#3fb950',
    labelTextColor: '#f0f6fc',
    loopTextColor: '#e6edf3',
    noteBkgColor: '#3d2e00',
    noteTextColor: '#f0f6fc',
    noteBorderColor: '#d29922',
    activationBkgColor: '#0d419d',
    activationBorderColor: '#58a6ff',
    sequenceNumberColor: '#ffffff',
    labelColor: '#e6edf3',
    altBackground: '#161b22',
  };
}

export function renderMarkdownHtml(markdown: string): string {
  const raw = marked.parse(markdown || '', { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['class'],
  });
}

export async function renderMermaidDiagrams(
  root: HTMLElement,
  theme: 'dark' | 'light'
): Promise<void> {
  const sources = Array.from(
    root.querySelectorAll<HTMLElement>('pre.md-mermaid-source, pre code.language-mermaid')
  );

  const blocks: { el: HTMLElement; code: string }[] = [];
  for (const node of sources) {
    const pre =
      node.tagName === 'CODE' ? (node.parentElement as HTMLElement | null) : node;
    const codeEl = node.tagName === 'CODE' ? node : node.querySelector('code');
    const code = (codeEl?.textContent || node.textContent || '').trim();
    if (!pre || !code) continue;
    blocks.push({ el: pre, code });
  }

  if (blocks.length === 0) return;

  const mermaid = (await import('mermaid')).default;
  // Re-initialize every time so light/dark switches cleanly (mermaid keeps global config).
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    darkMode: theme === 'dark',
    themeVariables: getMermaidThemeVariables(theme),
    fontFamily: 'Segoe UI, system-ui, sans-serif',
  });

  for (const block of blocks) {
    const host = document.createElement('div');
    host.className = 'md-mermaid';
    host.dataset.theme = theme;
    block.el.replaceWith(host);

    try {
      await mermaid.parse(block.code);
      const id = `mermaid-${theme}-${Math.random().toString(36).slice(2, 10)}`;
      const { svg } = await mermaid.render(id, block.code);
      host.innerHTML = svg;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      host.className = 'md-mermaid md-mermaid-error';
      host.innerHTML = `<pre><code>${escapeHtml(block.code)}</code></pre><p>${escapeHtml(message)}</p>`;
    }
  }
}

export function getDocumentTheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

/** Self-contained HTML document for PDF export of the rendered preview. */
export function buildMarkdownPdfDocument(
  title: string,
  bodyHtml: string,
  theme: 'dark' | 'light'
): string {
  const isLight = theme === 'light';
  const bg = isLight ? '#ffffff' : '#0d1117';
  const fg = isLight ? '#1f2328' : '#e6edf3';
  const muted = isLight ? '#656d76' : '#8b949e';
  const border = isLight ? '#d0d7de' : '#30363d';
  const codeBg = isLight ? '#f6f8fa' : '#161b22';
  const accent = isLight ? '#0969da' : '#58a6ff';
  const mermaidBg = isLight ? '#f6f8fa' : '#161b22';

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: ${bg};
    color: ${fg};
    font-family: "Segoe UI", system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
  }
  article { max-width: 100%; }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    margin: 1.1em 0 0.4em;
    font-weight: 650;
  }
  h1 { font-size: 1.7rem; border-bottom: 1px solid ${border}; padding-bottom: 0.25em; }
  h2 { font-size: 1.35rem; border-bottom: 1px solid ${border}; padding-bottom: 0.2em; }
  h3 { font-size: 1.15rem; }
  p { margin: 0.65em 0; }
  a { color: ${accent}; }
  ul, ol { margin: 0.55em 0; padding-left: 1.4em; }
  blockquote {
    margin: 0.8em 0;
    padding: 0.15em 0 0.15em 0.85em;
    border-left: 3px solid ${accent};
    color: ${muted};
  }
  code {
    font-family: Consolas, Monaco, monospace;
    font-size: 0.88em;
    padding: 0.1em 0.3em;
    border-radius: 4px;
    background: ${codeBg};
  }
  pre {
    margin: 0.85em 0;
    padding: 10px 12px;
    overflow: auto;
    border-radius: 6px;
    border: 1px solid ${border};
    background: ${codeBg};
  }
  pre code { padding: 0; background: transparent; }
  table { border-collapse: collapse; width: 100%; margin: 0.85em 0; }
  th, td { border: 1px solid ${border}; padding: 6px 8px; text-align: left; }
  th { background: ${codeBg}; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid ${border}; margin: 1.2em 0; }
  .md-mermaid {
    margin: 1em 0;
    padding: 10px;
    text-align: center;
    border: 1px solid ${border};
    border-radius: 6px;
    background: ${mermaidBg};
    page-break-inside: avoid;
  }
  .md-mermaid svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
<article>${bodyHtml}</article>
</body>
</html>`;
}
