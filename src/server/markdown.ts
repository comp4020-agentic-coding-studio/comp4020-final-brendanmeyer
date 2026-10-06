// A small, dependency-free Markdown -> HTML renderer. It only needs to
// cover what README.md actually uses: ATX headings, paragraphs, bullet
// lists, fenced code blocks, links and images. spec/invariants.test.ts
// only checks that headings appear as text, in order, not full
// CommonMark fidelity, so that's the bar this meets.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_m, alt, src) => `<img alt="${alt}" src="${src}">`);
  out = out.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_m, label, href) => `<a href="${href}">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const flushList = (): void => {
    if (list) {
      html.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^ {0,3}(```|~~~)/);
    if (fence) {
      flushParagraph();
      flushList();
      const marker = fence[1];
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(marker)) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip the closing fence
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    const bullet = line.match(/^ {0,3}[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list = list ?? [];
      list.push(bullet[1]);
      i++;
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      i++;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
    i++;
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}
