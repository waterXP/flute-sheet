const input = document.getElementById('input');
const keySelect = document.getElementById('key');
const octaveSelect = document.getElementById('octave');
const labelModeSelect = document.getElementById('label-mode');
const output = document.getElementById('output');
const table = document.getElementById('fingering-table');
const generateBtn = document.getElementById('generate');
const printBtn = document.getElementById('print');
const songTitle = document.getElementById('song-title');
const printZoom = document.getElementById('print-zoom');

const scaleSteps = {
  C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  F: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
  Bb: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
  Eb: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
};

const simplePatterns = ['XXXXXX', 'XXXXXO', 'XXXXOO', 'XXXOOO', 'XXOOOO', 'XOOOOO', 'OOOOOO'];

function buildSimpleDefaults(key) {
  const steps = scaleSteps[key];
  const mapping = {};
  [4, 5].forEach((octave) => {
    steps.forEach((note, index) => {
      mapping[`${note}${octave}`] = simplePatterns[index];
    });
  });
  mapping[`${steps[0]}6`] = simplePatterns[0];
  return mapping;
}

const defaultFingeringsByKey = {
  D: {
    D4: 'XXXXXX',
    'D#4': 'XXXXXH',
    E4: 'XXXXXO',
    F4: 'XXXXHO',
    'F#4': 'XXXXOO',
    G4: 'XXXOOO',
    'G#4': ['XXHOOO', 'XXOXXX'],
    A4: 'XXOOOO',
    'A#4': ['XHOOOO', 'XOXXXX'],
    B4: 'XOOOOO',
    'Bb4': ['OXXOOO', 'HOOOOO'],
    'C#5': ['OOOOOO', 'OOOXXX'],
    D5: ['HXXXXX', 'XXXXXX', 'OXXXXX'],
    'D#5': 'XXXXXH',
    E5: 'XXXXXO',
    F5: 'XXXXHO',
    'F#5': 'XXXXOO',
    G5: 'XXXOOO',
    'G#5': ['XXHOOO', 'XXOXOO'],
    A5: 'XXOOOO',
    'A#5': ['XHOOOO', 'XOXOOO'],
    B5: 'XOOOOO',
    'Bb5': ['OXOOOO', 'HOOOOO'],
    'C#6': ['OOOOOO', 'OOOXXX'],
    D6: ['OXXOOO', 'OXXXXX'],
    E6: 'XXOOXX',
    'F#6': 'XOXXXX',
    G6: 'XOXOOX',
    A6: 'OXXXXO',
  },
  C: buildSimpleDefaults('C'),
  G: buildSimpleDefaults('G'),
  A: buildSimpleDefaults('A'),
  F: buildSimpleDefaults('F'),
  Bb: buildSimpleDefaults('Bb'),
  Eb: buildSimpleDefaults('Eb'),
};

const numberLabelsByKey = {
  D: {
    D4: '1',
    'D#4': '1#',
    E4: '2',
    F4: '3b',
    'F#4': '3',
    G4: '4',
    'G#4': '4#',
    A4: '5',
    'A#4': '5#',
    B4: '6',
    'Bb4': '7b',
    'C#5': '7',
    D5: "1'",
    'D#5': "1#'",
    E5: "2'",
    F5: "3b'",
    'F#5': "3'",
    G5: "4'",
    'G#5': "4#'",
    A5: "5'",
    'A#5': "5#'",
    B5: "6'",
    'Bb5': "7b'",
    'C#6': "7'",
    D6: "1''",
    E6: "2''",
    'F#6': "3''",
    G6: "4''",
    A6: "5''",
  },
};

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Ignore storage errors (e.g. file:// origin restrictions).
    }
  },
};

if (songTitle) {
  const storedTitle = storage.get('song-title');
  if (storedTitle !== null) {
    songTitle.textContent = storedTitle;
  }
  songTitle.addEventListener('input', () => {
    storage.set('song-title', songTitle.textContent.trim());
  });
}

if (printZoom) {
  const storedZoom = storage.get('print-zoom');
  if (storedZoom) {
    printZoom.value = storedZoom;
  }
  const applyZoom = () => {
    const zoomValue = Number(printZoom.value) / 100;
    if (!Number.isNaN(zoomValue) && zoomValue > 0) {
      document.documentElement.style.setProperty('--print-zoom', zoomValue.toString());
    }
    storage.set('print-zoom', printZoom.value);
  };
  printZoom.addEventListener('input', applyZoom);
  applyZoom();
}

const activeVariants = {};
let fingerings = {};

function cloneDefaults(key) {
  const defaults = defaultFingeringsByKey[key] || {};
  return JSON.parse(JSON.stringify(defaults));
}

function loadFingeringsForKey(key) {
  const storedRaw = storage.get(`fingerings-${key}`);
  let stored = JSON.parse(storedRaw || '{}');
  if (!storedRaw) {
    const legacyRaw = storage.get('fingerings');
    if (legacyRaw) {
      stored = JSON.parse(legacyRaw || '{}');
      storage.set(`fingerings-${key}`, JSON.stringify(stored));
    }
  }
  fingerings = { ...cloneDefaults(key), ...stored };
  Object.keys(activeVariants).forEach((k) => delete activeVariants[k]);
}

function normalizeVariants(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePattern(item));
  }
  return [normalizePattern(value)];
}

function formatNoteLabel(note) {
  const match = note.match(/^([A-G])([#b]?)(\d)$/);
  if (!match) return note;
  const letter = match[1];
  const accidental = match[2] || '';
  const octave = parseInt(match[3], 10);
  const base = 4;
  if (octave === base) return `${letter}${accidental}`;
  const delta = octave - base;
  const marker = delta > 0 ? '+' : '-';
  return `${letter}${accidental}${marker.repeat(Math.abs(delta))}`;
}

function formatNumberLabel(note) {
  const overrides = numberLabelsByKey[keySelect.value];
  if (overrides && overrides[note]) return overrides[note];
  const match = note.match(/^([A-G])([#b]?)(\d)$/);
  if (!match) return note;
  const letter = match[1];
  const accidental = match[2] || '';
  const octave = parseInt(match[3], 10);
  const base = 4;
  const scale = scaleSteps[keySelect.value];
  const degree = scale.findIndex((value) => value === `${letter}${accidental}`);
  if (degree === -1) return formatNoteLabel(note);
  const delta = octave - base;
  const marker = delta > 0 ? '+' : '-';
  const suffix = delta === 0 ? '' : marker.repeat(Math.abs(delta));
  return `${degree + 1}${suffix}`;
}

function formatLabel(note) {
  return labelModeSelect.value === 'number'
    ? formatNumberLabel(note)
    : formatNoteLabel(note);
}

function getVariants(note) {
  if (!fingerings[note]) return [];
  return normalizeVariants(fingerings[note]);
}

function findKeyByBare(bare) {
  if (fingerings[`${bare}4`]) return `${bare}4`;
  const match = Object.keys(fingerings).find((key) => key.replace(/\d/g, '') === bare);
  return match || null;
}

function normalizePattern(pattern) {
  return pattern
    .toUpperCase()
    .replace(/[^XOH]/g, '')
    .padEnd(6, 'O')
    .slice(0, 6);
}

function cycleChar(char) {
  if (char === 'X') return 'O';
  if (char === 'O') return 'H';
  return 'X';
}

function renderHoleRow(pattern, onChange, isVertical = false) {
  const wrapper = document.createElement('div');
  wrapper.className = isVertical ? 'fingering vertical' : 'fingering';

  pattern.split('').forEach((char, index) => {
    const hole = document.createElement('span');
    hole.className = 'hole';
    if (char === 'X') hole.classList.add('filled');
    if (char === 'H') hole.classList.add('half');

    hole.addEventListener('click', () => {
      const updated = pattern
        .split('')
        .map((current, idx) => (idx === index ? cycleChar(current) : current))
        .join('');
      onChange(updated);
    });

    wrapper.appendChild(hole);
  });

  return wrapper;
}

function renderTable() {
  table.innerHTML = '';
  Object.keys(fingerings).forEach((note) => {
      const item = document.createElement('div');
      item.className = 'table-item';

      const label = document.createElement('strong');
      label.textContent = formatLabel(note);
      const header = document.createElement('div');
      header.className = 'table-header';

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'variant-add';
      add.textContent = '+';
      add.title = '添加指法';
      add.setAttribute('aria-label', '添加指法');
      add.addEventListener('click', () => {
        const next = getVariants(note);
        next.push('OOOOOO');
        fingerings[note] = next;
        storage.set(`fingerings-${keySelect.value}`, JSON.stringify(fingerings));
        renderTable();
        generate();
      });

      header.append(label, add);
      item.append(header);

      const variants = getVariants(note);
      const list = document.createElement('div');
      list.className = 'variant-list';

      variants.forEach((variant, idx) => {
        const row = document.createElement('div');
        row.className = 'variant-row';

        const holes = renderHoleRow(variant, (updated) => {
          const next = getVariants(note);
          next[idx] = normalizePattern(updated);
          fingerings[note] = next;
          storage.set(`fingerings-${keySelect.value}`, JSON.stringify(fingerings));
          renderTable();
          generate();
        }, true);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'variant-remove';
        remove.textContent = '-';
        remove.title = '移除指法';
        remove.setAttribute('aria-label', '移除指法');
        remove.addEventListener('click', () => {
          const next = getVariants(note).filter((_, i) => i !== idx);
          fingerings[note] = next.length ? next : ['OOOOOO'];
          storage.set(`fingerings-${keySelect.value}`, JSON.stringify(fingerings));
          renderTable();
          generate();
        });

        row.append(holes, remove);
        list.append(row);
      });

      item.append(list);
      table.append(item);
    });
}

function noteToFingering(note) {
  if (fingerings[note]) {
    return { patterns: getVariants(note), missing: false };
  }
  const bare = note.replace(/\d/g, '');
  const fallbackKey = findKeyByBare(bare);
  if (fallbackKey) {
    return { patterns: getVariants(fallbackKey), missing: false };
  }
  return { patterns: ['OOOOOO'], missing: true };
}

function parseInput(text) {
  const key = keySelect.value;
  const octaveBase = parseInt(octaveSelect.value, 10);
  const scale = scaleSteps[key];
  const items = [];
  let index = 0;

  const pushSpacer = () => {
    if (!items.length || items[items.length - 1].type !== 'spacer') {
      items.push({ type: 'spacer' });
    }
  };

  while (index < text.length) {
    const current = text[index];

    if (/\s/.test(current)) {
      while (index < text.length && /\s/.test(text[index])) index += 1;
      pushSpacer();
      continue;
    }

    if (/[1-7]/.test(current)) {
      const match = text.slice(index).match(/^([1-7])([#b]?)([\.']*)/);
      if (match) {
        const degree = parseInt(match[1], 10) - 1;
        const accidental = match[2];
        const marks = match[3] || '';
        let note = scale[degree];
        let octave = octaveBase;

        const down = (marks.match(/\./g) || []).length;
        const up = (marks.match(/'/g) || []).length;
        octave += up - down;

        if (accidental === '#') {
          note = `${note}#`;
        } else if (accidental === 'b') {
          note = `${note}b`;
        }

        items.push({ type: 'note', value: `${note}${octave}` });
        index += match[0].length;
        continue;
      }
    }

    if (/[A-Ga-g]/.test(current)) {
      const match = text.slice(index).match(/^([A-Ga-g])([#b]?)(\d?)/);
      if (match) {
        const letter = match[1].toUpperCase();
        const accidental = match[2] || '';
        const octave = match[3] || octaveBase;
        items.push({ type: 'note', value: `${letter}${accidental}${octave}` });
        index += match[0].length;
        continue;
      }
    }

    index += 1;
    pushSpacer();
  }

  return items;
}

function renderOutput(items) {
  output.innerHTML = '';
  const segments = [];
  let current = [];

  items.forEach((item) => {
    if (item.type === 'spacer') {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      return;
    }
    current.push(item.value);
  });

  if (current.length) segments.push(current);
  if (!segments.length) segments.push([]);

  const titleText = (songTitle && songTitle.textContent.trim()) || '指法结果';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'card-wrap title-wrap';
  const titleCard = document.createElement('div');
  titleCard.className = 'card title-card';
  titleCard.textContent = titleText;
  titleWrap.append(titleCard);
  output.append(titleWrap);

  segments.forEach((segment, segmentIndex) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrap';

    const card = document.createElement('div');
    card.className = 'card segment';

    const sequence = document.createElement('div');
    sequence.className = 'sequence';

    segment.forEach((note, noteIndex) => {
      const instanceKey = `${note}-${segmentIndex}-${noteIndex}`;
      const column = document.createElement('div');
      column.className = 'note-column';

      const label = document.createElement('div');
      label.className = 'note-label';
      label.textContent = formatLabel(note);

      const { patterns, missing } = noteToFingering(note);
      const index = activeVariants[instanceKey] || 0;
      const fingering = patterns[index % patterns.length];
      if (missing) label.classList.add('missing');

      const pattern = document.createElement('div');
      pattern.className = 'fingering vertical';
      fingering.split('').forEach((char) => {
        const hole = document.createElement('span');
        hole.className = 'hole';
        if (char === 'X') hole.classList.add('filled');
        if (char === 'H') hole.classList.add('half');
        pattern.appendChild(hole);
      });

      column.append(label, pattern);

      if (patterns.length > 1) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'variant-toggle';
        toggle.textContent = '⇄';
        toggle.title = '切换指法';
        toggle.setAttribute('aria-label', '切换指法');
        toggle.addEventListener('click', () => {
          activeVariants[instanceKey] = (index + 1) % patterns.length;
          generate();
        });
        column.append(toggle);
      }

      sequence.append(column);
    });

    card.append(sequence);
    wrapper.append(card);
    output.append(wrapper);
  });
}

function generate() {
  if (!Object.keys(fingerings).length) {
    loadFingeringsForKey(keySelect.value);
    renderTable();
  }
  const items = parseInput(input.value);
  renderOutput(items.length ? items : []);
}

function seedDefaults() {
  if (!input.value.trim()) {
    input.value = "1 2 3 4 5 6 7 1'\nD4 E4 F#4 G4 A4 B4 C#5 D5";
  }
}

generateBtn.addEventListener('click', generate);
keySelect.addEventListener('change', () => {
  loadFingeringsForKey(keySelect.value);
  renderTable();
  generate();
});
octaveSelect.addEventListener('change', generate);
labelModeSelect.addEventListener('change', () => {
  renderTable();
  generate();
});
printBtn.addEventListener('click', () => window.print());

seedDefaults();
loadFingeringsForKey(keySelect.value);
renderTable();
generate();
