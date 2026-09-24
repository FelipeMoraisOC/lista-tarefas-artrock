// ── EasyMDE editor wrapper ────────────────────────────────
// Provides a rich Markdown editor with toolbar and shortcuts:
// Ctrl+B → Bold, Ctrl+I → Italic, Ctrl+H → Heading
// Toolbar: H1-H3, Bold, Italic, Lists, Code, Quote, Link, Preview

let _instances = [];

/**
 * Initialize EasyMDE on a textarea element.
 * @param {HTMLTextAreaElement} textarea - The textarea to enhance
 * @param {object} opts - Options
 * @param {string} opts.placeholder - Placeholder text
 * @param {number} opts.minHeight - Minimum editor height in px
 * @param {boolean} opts.autofocus - Focus on init
 * @returns {EasyMDE|null}
 */
export function initEditor(textarea, opts = {}) {
  if (!textarea || !window.EasyMDE) return null;

  const editor = new EasyMDE({
    element: textarea,
    autofocus: opts.autofocus ?? false,
    spellChecker: false,
    status: false,
    minHeight: (opts.minHeight ?? 150) + 'px',
    placeholder: opts.placeholder ?? 'Escreva em Markdown...',
    autoDownloadFontAwesome: false,
    toolbar: [
      {
        name: 'heading-1',
        action: EasyMDE.toggleHeading1,
        className: 'fa fa-header',
        title: 'Título H1',
        text: 'H1',
      },
      {
        name: 'heading-2',
        action: EasyMDE.toggleHeading2,
        className: 'fa fa-header',
        title: 'Título H2',
        text: 'H2',
      },
      {
        name: 'heading-3',
        action: EasyMDE.toggleHeading3,
        className: 'fa fa-header',
        title: 'Título H3',
        text: 'H3',
      },
      '|',
      {
        name: 'bold',
        action: EasyMDE.toggleBold,
        className: 'fa fa-bold',
        title: 'Negrito (Ctrl+B)',
        text: 'B',
      },
      {
        name: 'italic',
        action: EasyMDE.toggleItalic,
        className: 'fa fa-italic',
        title: 'Itálico (Ctrl+I)',
        text: 'I',
      },
      {
        name: 'strikethrough',
        action: EasyMDE.toggleStrikethrough,
        className: 'fa fa-strikethrough',
        title: 'Riscado',
        text: 'S̶',
      },
      '|',
      {
        name: 'unordered-list',
        action: EasyMDE.toggleUnorderedList,
        className: 'fa fa-list-ul',
        title: 'Lista',
        text: '• Lista',
      },
      {
        name: 'ordered-list',
        action: EasyMDE.toggleOrderedList,
        className: 'fa fa-list-ol',
        title: 'Lista numerada',
        text: '1. Lista',
      },
      '|',
      {
        name: 'code',
        action: EasyMDE.toggleCodeBlock,
        className: 'fa fa-code',
        title: 'Bloco de Código',
        text: '</>',
      },
      {
        name: 'quote',
        action: EasyMDE.toggleBlockquote,
        className: 'fa fa-quote-left',
        title: 'Citação',
        text: '" "',
      },
      {
        name: 'link',
        action: EasyMDE.drawLink,
        className: 'fa fa-link',
        title: 'Link',
        text: '🔗',
      },
      '|',
      {
        name: 'preview',
        action: EasyMDE.togglePreview,
        className: 'fa fa-eye no-disable',
        title: 'Preview (Ctrl+P)',
        text: '👁',
      },
    ],
    shortcuts: {
      toggleBold: 'Ctrl-B',
      toggleItalic: 'Ctrl-I',
      toggleHeadingSmaller: 'Ctrl-H',
      togglePreview: 'Ctrl-P',
    },
    previewRender: (text) => {
      if (window.marked) return window.marked.parse(text);
      return text;
    },
  });

  _instances.push(editor);
  return editor;
}

/**
 * Destroy all active EasyMDE instances (call on modal close).
 */
export function destroyAllEditors() {
  _instances.forEach(ed => {
    try { ed.toTextArea(); } catch { }
  });
  _instances = [];
}

/**
 * Destroy a specific EasyMDE instance.
 */
export function destroyEditor(editor) {
  if (!editor) return;
  try { editor.toTextArea(); } catch { }
  _instances = _instances.filter(e => e !== editor);
}
