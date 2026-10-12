/**
 * The viewer HUD.
 *
 * A tiny, framework-free control panel: title + credits, the model-source
 * picker, the display toggles (auto-rotate / wireframe / day-night), a frame
 * rate readout and a status line used to report missing assets. Styling lives
 * in `index.html`; this module only creates elements and wires up callbacks.
 */

/** @param {string} tag @param {string} [className] @param {string} [text] */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** A labelled checkbox row. */
function toggleRow(id, label, checked, onChange) {
  const row = el('label', 'hud-toggle');
  row.htmlFor = id;
  const input = el('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  row.appendChild(input);
  row.appendChild(el('span', 'hud-toggle-label', label));
  return { row, input };
}

/**
 * Create the HUD inside `root`.
 *
 * @param {HTMLElement} root container the panel is appended to
 * @param {object} handlers
 * @param {(name: string) => void} [handlers.onSource]
 * @param {(on: boolean) => void} [handlers.onAutoRotate]
 * @param {(on: boolean) => void} [handlers.onWireframe]
 * @param {(on: boolean) => void} [handlers.onNight]
 * @returns {{
 *   element: HTMLElement,
 *   setFps: (fps: number) => void,
 *   setStatus: (text: string, kind?: 'info'|'ok'|'warn'|'error') => void,
 *   setSource: (name: string) => void,
 *   setAutoRotate: (on: boolean) => void,
 *   setWireframe: (on: boolean) => void,
 *   setNight: (on: boolean) => void,
 *   setBusy: (busy: boolean) => void,
 * }}
 */
export function createHud(root, handlers = {}) {
  const panel = el('section', 'hud-panel');

  // --- header ---------------------------------------------------------------
  const header = el('header', 'hud-header');
  header.appendChild(el('h1', 'hud-title', 'BKV city bus'));
  header.appendChild(el('p', 'hud-subtitle', '12 m Budapest blue livery — mesh + textures generated procedurally in JS'));
  panel.appendChild(header);

  // --- model source ---------------------------------------------------------
  const sourceField = el('div', 'hud-field');
  const sourceLabel = el('label', 'hud-field-label', 'Model source');
  sourceLabel.htmlFor = 'hud-source';
  const sourceSelect = el('select', 'hud-select');
  sourceSelect.id = 'hud-source';
  for (const [value, label] of [
    ['procedural', 'Procedural (buildBus)'],
    ['obj', 'Exported OBJ + MTL'],
  ]) {
    const option = el('option', null, label);
    option.value = value;
    sourceSelect.appendChild(option);
  }
  sourceSelect.addEventListener('change', () => handlers.onSource?.(sourceSelect.value));
  sourceField.appendChild(sourceLabel);
  sourceField.appendChild(sourceSelect);
  panel.appendChild(sourceField);

  // --- toggles --------------------------------------------------------------
  const toggles = el('div', 'hud-toggles');
  const autoRotate = toggleRow('hud-auto-rotate', 'Auto-rotate', true, (on) => handlers.onAutoRotate?.(on));
  const wireframe = toggleRow('hud-wireframe', 'Wireframe', false, (on) => handlers.onWireframe?.(on));
  const night = toggleRow('hud-night', 'Night', false, (on) => handlers.onNight?.(on));
  toggles.appendChild(autoRotate.row);
  toggles.appendChild(wireframe.row);
  toggles.appendChild(night.row);
  panel.appendChild(toggles);

  // --- footer: fps + status -------------------------------------------------
  const footer = el('footer', 'hud-footer');
  const fps = el('span', 'hud-fps', '— fps');
  footer.appendChild(fps);
  panel.appendChild(footer);

  const status = el('p', 'hud-status', '');
  status.dataset.kind = 'info';
  panel.appendChild(status);

  root.appendChild(panel);

  return {
    element: panel,
    setFps(value) {
      fps.textContent = `${Math.round(value)} fps`;
    },
    setStatus(text, kind = 'info') {
      status.textContent = text;
      status.dataset.kind = kind;
      status.classList.toggle('hud-status-visible', Boolean(text));
    },
    setSource(name) {
      sourceSelect.value = name;
    },
    setAutoRotate(on) {
      autoRotate.input.checked = on;
    },
    setWireframe(on) {
      wireframe.input.checked = on;
    },
    setNight(on) {
      night.input.checked = on;
    },
    setBusy(busy) {
      panel.classList.toggle('hud-busy', busy);
      sourceSelect.disabled = busy;
    },
  };
}
