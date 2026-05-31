/* Teacher Tool Builder — ported from teachedos into teached (branch merge/teachedos-features).
   Self-contained panel (Generate task / Add to board). Depends on:
   - js/teacher-tools-data.js  → window.BOARD_TEACHER_TOOLS
   - board helpers from the main inline script: addCard, getBoardViewportCenter,
     snapshot, defaultTextData, esc, toast, renumberFrames, zoomToCard, setCardParentFrame. */
(function(){
'use strict';
const BOARD_TEACHER_TOOLS = window.BOARD_TEACHER_TOOLS || [];
// teached has no bulk-snapshot suppressor — harmless local stand-in.
let _suppressSnapshot = 0;
let activeTeacherToolBuilder = null;
let lastTeacherToolBuilderOutput = null;

// ── tool metadata (from teachedos) ──
const BOARD_TOOL_NAMES = {
  all:'All', reading:'Reading', vocabulary:'Vocab', writing:'Writing',
  speaking:'Speaking', grammar:'Grammar', listening:'Listening', utility:'Utility'
};
const BOARD_TOOL_META = {
  all:       { icon:'✦', color:'#050038', bg:'rgba(5,0,56,.08)' },
  reading:   { icon:'📖', color:'#4262FF', bg:'rgba(66,98,255,.12)' },
  vocabulary:{ icon:'🧠', color:'#EC2D8C', bg:'rgba(236,45,140,.12)' },
  writing:   { icon:'✍️', color:'#7C3AED', bg:'rgba(124,58,237,.12)' },
  speaking:  { icon:'💬', color:'#FF7A1A', bg:'rgba(255,122,26,.14)' },
  grammar:   { icon:'⚙️', color:'#0EA5A4', bg:'rgba(14,165,164,.12)' },
  listening: { icon:'🎧', color:'#0891B2', bg:'rgba(8,145,178,.12)' },
  utility:   { icon:'🧰', color:'#5E5E4A', bg:'rgba(94,94,74,.12)' },
};

// ── placement helper (from teachedos) ──
function findFreePlacement(cx, cy, w, h) {
  const cards = (state && Array.isArray(state.cards)) ? state.cards : [];
  if (!cards.length || !Number.isFinite(cx) || !Number.isFinite(cy)) {
    return { x: cx, y: cy };
  }
  const GAP = 32;
  const topLevel = cards.filter(c => !(c.data && c.data.parentFrame));
  const overlaps = (x0, y0) => {
    const ax1 = x0, ay1 = y0, ax2 = x0 + w, ay2 = y0 + h;
    return topLevel.some(c => {
      const bx1 = c.x - GAP, by1 = c.y - GAP;
      const bx2 = c.x + (c.w || 0) + GAP, by2 = c.y + (c.h || 0) + GAP;
      return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
    });
  };
  // Spiral search: try the desired spot, then expanding rings of offsets.
  const baseX = cx - w / 2, baseY = cy - h / 2;
  if (!overlaps(baseX, baseY)) return { x: cx, y: cy };
  const step = Math.max(w, h) * 0.55 + GAP;
  for (let ring = 1; ring <= 12; ring++) {
    for (const [dx, dy] of [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]) {
      const nx = baseX + dx * step * ring;
      const ny = baseY + dy * step * ring;
      if (!overlaps(nx, ny)) return { x: nx + w / 2, y: ny + h / 2 };
    }
  }
  // Fallback: drop far to the right of everything so it's at least visible.
  const maxRight = topLevel.reduce((m, c) => Math.max(m, c.x + (c.w || 0)), baseX);
  return { x: maxRight + GAP + w / 2, y: cy };
}

// ── builder core (from teachedos) ──
function openTeacherToolBuilder(toolId) {
  const tool = BOARD_TEACHER_TOOLS.find(t => t.id === toolId);
  if (!tool) return;
  activeTeacherToolBuilder = tool;
  lastTeacherToolBuilderOutput = null;
  document.getElementById('tbuilder-title').textContent = tool.title;
  document.getElementById('tbuilder-sub').textContent = tool.desc;
  document.getElementById('tbuilder-kicker').textContent = `${BOARD_TOOL_NAMES[tool.cat] || tool.cat} / ${tool.kind}`;
  document.getElementById('tbuilder-chip').textContent = 'ready';
  document.getElementById('tbuilder-output').innerHTML = '<div class="tbuilder-empty">Fill the fields and click Generate task.<br>This will create a real activity, not a placeholder note.</div>';
  document.getElementById('tool-builder-panel')?.classList.add('open');
}

function closeTeacherToolBuilder() {
  document.getElementById('tool-builder-panel')?.classList.remove('open');
}

document.getElementById('tool-builder-panel')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeTeacherToolBuilder();
});

function readTeacherToolBuilderInput() {
  const getVal = id => document.getElementById(id)?.value?.trim() || '';
  return {
    tool: activeTeacherToolBuilder,
    level: getVal('tbuilder-level') || 'B1',
    count: Math.max(3, Math.min(12, parseInt(getVal('tbuilder-count') || '6', 10) || 6)),
    topic: getVal('tbuilder-topic') || 'Practical English',
    source: getVal('tbuilder-source'),
    vocab: getVal('tbuilder-vocab'),
    extra: getVal('tbuilder-extra'),
  };
}

function teacherToolVocabList(text, fallbackTopic, count = 6) {
  const raw = String(text || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
  const fallback = ['problem','reason','example','solution','opinion','follow-up','evidence','summary'];
  return (raw.length ? raw : fallback.map(w => `${w} (${fallbackTopic})`)).slice(0, count);
}

function teacherToolSourceSentences(text, topic, count = 6) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(x => x.trim())
    .filter(Boolean);
  if (s.length) return s.slice(0, count);
  return [
    `${topic} can be easy to understand when students see a clear example.`,
    `Students often need useful language, controlled practice and time to produce their own answer.`,
    `A good task gives a reason to communicate, not only a gap to complete.`,
    `Teacher feedback should focus on one strong point and one next improvement.`,
    `The final activity should help students reuse the target language in a personal way.`,
    `Homework should recycle the same language with a small new challenge.`
  ].slice(0, count);
}

function generateTeacherToolOutput(input) {
  const tool = input.tool;
  const vocab = teacherToolVocabList(input.vocab, input.topic, input.count);
  const sentences = teacherToolSourceSentences(input.source, input.topic, input.count);
  const title = `${input.level} · ${tool.title}: ${input.topic}`;
  const focus = input.extra ? `Teacher focus: ${input.extra}` : `Teacher focus: make ${input.topic.toLowerCase()} clear, active and measurable.`;
  const sections = [];

  if (tool.cat === 'vocabulary') {
    sections.push({title:'Vocabulary set', items:vocab.map((w,i)=>`${i+1}. ${w} — student-friendly definition + personal example`)});
    sections.push({title:'Student task', items:[
      'Match each item with a definition or image.',
      'Write one personal sentence with three new items.',
      'Swap sentences and improve one collocation or word form.'
    ]});
    sections.push({title:'Game handoff', items:['Use as flashcards, memory match, word sorting, odd-one-out or speed quiz.']});
  } else if (tool.cat === 'reading') {
    sections.push({title:'Reading task', items:[
      `Before reading: predict three ideas about ${input.topic}.`,
      'Gist: choose the best one-sentence summary.',
      ...sentences.slice(0, Math.min(4, input.count)).map((s,i)=>`Detail ${i+1}: What does this mean? "${s.slice(0, 120)}"`)
    ]});
    sections.push({title:'After reading', items:['Find 5 useful phrases.', 'Ask one open question.', 'Give a personal opinion with evidence from the text.']});
  } else if (tool.cat === 'grammar') {
    sections.push({title:'Grammar construction', items:[
      `Target structure: ${input.topic}.`,
      'Notice: find the pattern in context.',
      'Rule: students complete a one-line rule.',
      ...vocab.slice(0, Math.min(5, input.count)).map((w,i)=>`Practice ${i+1}: Write/correct a sentence using "${w}".`)
    ]});
    sections.push({title:'Answer key logic', items:['Check meaning first, then form, then pronunciation or spelling.', 'Students explain why the wrong option is wrong.']});
  } else if (tool.cat === 'speaking') {
    sections.push({title:'Speaking constructor', items:[
      `Warm-up: What is your experience with ${input.topic.toLowerCase()}?`,
      `Useful phrases: ${vocab.slice(0, 5).join(', ')}.`,
      'Pair task: Student A asks for details, Student B gives reasons and examples.',
      'Upgrade: add a follow-up question and a reaction phrase.'
    ]});
    sections.push({title:'Feedback', items:['One strong phrase', 'One pronunciation/grammar correction', 'One next-level phrase to reuse']});
  } else if (tool.cat === 'listening') {
    sections.push({title:'Listening constructor', items:[
      `Prediction: What words do you expect in a listening about ${input.topic}?`,
      'First listen: main idea only.',
      'Second listen: answer detail questions.',
      'Transcript mining: collect useful chunks.',
      'After listening: retell the audio in 45 seconds.'
    ]});
    sections.push({title:'Question bank', items:sentences.slice(0, input.count).map((s,i)=>`${i+1}. What does the speaker mean by: "${s.slice(0, 100)}"?`)});
  } else if (tool.cat === 'writing') {
    sections.push({title:'Writing constructor', items:[
      `Plan: create a clear answer about ${input.topic}.`,
      'Draft: write a short controlled version.',
      `Must use: ${vocab.slice(0, Math.min(6, input.count)).join(', ')}.`,
      'Upgrade: improve linking, examples and accuracy.',
      'Self-check: underline the strongest sentence and rewrite the weakest one.'
    ]});
    sections.push({title:'Success criteria', items:['Clear structure', 'Target language used accurately', 'At least one example or reason', 'One self-correction']});
  } else {
    sections.push({title:'Task constructor', items:[
      `Goal: create a ${tool.kind.toLowerCase()} for ${input.topic}.`,
      `Level: ${input.level}. Items: ${input.count}.`,
      `Target language: ${vocab.slice(0, 6).join(', ')}.`,
      'Teacher prepares instructions, answer key and success criteria.',
      'Student output must be visible on the board.'
    ]});
    sections.push({title:'Teacher control', items:['Add examples', 'Set timing', 'Add answer key', 'Send to board or game builder']});
  }

  sections.push({title:'Teacher note', items:[focus, 'Generated inside TeachEd board tool constructor. Review and adapt before teaching.']});
  return { title, toolId:tool.id, cat:tool.cat, kind:tool.kind, level:input.level, topic:input.topic, vocab, sections };
}

function teacherToolOutputText(output) {
  if (!output) return '';
  return [
    output.title,
    `${BOARD_TOOL_NAMES[output.cat] || output.cat} / ${output.kind}`,
    '',
    ...output.sections.flatMap(s => [s.title, ...(s.items || []).map(i => '- ' + i), ''])
  ].join('\n').trim();
}

function renderTeacherToolBuilderOutput(output) {
  const body = document.getElementById('tbuilder-output');
  if (!body) return;
  document.getElementById('tbuilder-chip').textContent = `${output.level} / ${BOARD_TOOL_NAMES[output.cat] || output.cat}`;
  body.innerHTML = `
    <div class="tbuilder-section">
      <h4>${esc(output.title)}</h4>
      <p>${esc(output.kind)} · ${esc(output.topic)}</p>
    </div>
    ${output.sections.map(section => `
      <div class="tbuilder-section">
        <h4>${esc(section.title)}</h4>
        <ul>${(section.items || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>
    `).join('')}
  `;
}

function generateTeacherToolBuilder() {
  if (!activeTeacherToolBuilder) return;
  lastTeacherToolBuilderOutput = generateTeacherToolOutput(readTeacherToolBuilderInput());
  renderTeacherToolBuilderOutput(lastTeacherToolBuilderOutput);
}

function applyTeacherToolBuilderToBoard() {
  if (!activeTeacherToolBuilder) return;
  if (!lastTeacherToolBuilderOutput) generateTeacherToolBuilder();
  const output = lastTeacherToolBuilderOutput;
  if (!output) return;
  const tool = activeTeacherToolBuilder;
  const meta = BOARD_TOOL_META[output.cat] || BOARD_TOOL_META[tool.cat] || BOARD_TOOL_META.utility;

  // Layout grid for the customised template
  const FRAME_W = 1180;
  const FRAME_H = 760;
  const PAD = 26;
  const _c0 = getBoardViewportCenter() || { x: 320, y: 260 };
  const center = findFreePlacement(_c0.x, _c0.y, FRAME_W, FRAME_H);
  const x0 = Math.round(center.x - FRAME_W / 2);
  const y0 = Math.round(center.y - FRAME_H / 2);

  snapshot();
  _suppressSnapshot++;
  let frame;
  try {
    frame = addCard('frame', x0, y0, {
      title: `${meta.icon}  ${output.title}`,
      bg: meta.bg,
      border: meta.color,
      childIds: []
    }, FRAME_W, FRAME_H);

    // Header card: title + meta kicker + one-line goal
    const headerY = y0 + 56;
    const headerH = 100;
    const header = addCard('text', x0 + PAD, headerY, defaultTextData({
      text: `${output.title}\n${(BOARD_TOOL_NAMES[output.cat] || output.cat)} · ${output.kind}\n\nLevel · ${output.level || 'B1'}    Topic · ${output.topic || '—'}`,
      textColor: meta.color,
      bgColor: '#ffffff',
      align: 'left',
      fontSize: 15,
    }), FRAME_W - PAD * 2, headerH);
    if (frame && header) setCardParentFrame?.(header, frame);

    // Main sections — render up to 3 first sections as cards in a row.
    const sectionsY = headerY + headerH + 16;
    const sectionsH = 360;
    const sections = (output.sections || []).slice(0, 3);
    const colW = Math.floor((FRAME_W - PAD * 2 - 16 * (sections.length - 1)) / Math.max(sections.length, 1));
    const sectionColors = ['#FFE566', '#AFF4C6', '#CFE2FF'];
    sections.forEach((s, i) => {
      const sx = x0 + PAD + i * (colW + 16);
      const text = `${s.title}\n\n${(s.items || []).map(it => '• ' + it).join('\n')}`;
      const sticky = addCard('sticky', sx, sectionsY, {
        text,
        color: sectionColors[i % sectionColors.length]
      }, colW, sectionsH);
      if (frame && sticky) setCardParentFrame?.(sticky, frame);
    });

    // Bottom row: teacher checklist (left) + target language sticky (right)
    const bottomY = sectionsY + sectionsH + 18;
    const bottomH = 200;
    const halfW = Math.floor((FRAME_W - PAD * 2 - 18) / 2);

    const criteria = (output.sections || []).find(s => /criteria|teacher|feedback|control|note/i.test(s.title))
      || (output.sections || [])[output.sections?.length - 1];
    const checklistItems = (criteria?.items || ['Review task', 'Adapt to your group', 'Teach']).slice(0, 8)
      .map(t => ({ text: t, done: false }));
    const checklist = addCard('checklist', x0 + PAD, bottomY, {
      title: criteria?.title || '✅ Teacher checklist',
      items: checklistItems,
    }, halfW, bottomH);
    if (frame && checklist) setCardParentFrame?.(checklist, frame);

    const vocab = output.vocab || [];
    const langText = vocab.length
      ? `🗣 Target language\n\n${vocab.slice(0, 10).map((w, i) => `${i + 1}. ${w}`).join('\n')}`
      : `📋 Teacher prompt\n\nCreate a ${tool.kind.toLowerCase()} for level ${output.level || 'B1'} on:\n${output.topic || '____________'}\n\nFocus: ${output.extra || '____________'}`;
    const vocabSticky = addCard('sticky', x0 + PAD + halfW + 18, bottomY, {
      text: langText,
      color: '#FFD580'
    }, halfW, bottomH);
    if (frame && vocabSticky) setCardParentFrame?.(vocabSticky, frame);

    if (typeof renumberFrames === 'function') renumberFrames();
  } finally {
    _suppressSnapshot--;
  }

  if (frame?.id) {
    clearSelection?.();
    selectCard?.(frame.id);
    setTimeout(() => { try { zoomToCard?.(frame.id, true); } catch {} }, 80);
  }
  renderAllArrows?.();
  scheduleSave?.(); saveLocal?.();
  closeTeacherToolBuilder();
  toast('✨ Lesson task added to board');
}

async function copyTeacherToolBuilderOutput() {
  if (!lastTeacherToolBuilderOutput) generateTeacherToolBuilder();
  const text = teacherToolOutputText(lastTeacherToolBuilderOutput);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast('Task copied');
  } catch {
    toast('Copy blocked by browser');
  }
}


// ── lightweight launcher (replaces the teachedos tools-sidebar catalog) ──
function _ttbPopulateToolPicker(){
  const sel = document.getElementById('tbuilder-tool');
  if (!sel || sel._filled) return;
  sel.innerHTML = BOARD_TEACHER_TOOLS
    .map(t => `<option value="${t.id}">${(BOARD_TOOL_NAMES[t.cat]||t.cat)} · ${t.title}</option>`)
    .join('');
  sel._filled = true;
  sel.addEventListener('change', () => openTeacherToolBuilder(sel.value));
}
function openTeacherToolBuilderUI(){
  if (!BOARD_TEACHER_TOOLS.length){ (window.toast||console.log)('Tool library not loaded'); return; }
  _ttbPopulateToolPicker();
  const sel = document.getElementById('tbuilder-tool');
  const id = (sel && sel.value) || BOARD_TEACHER_TOOLS[0].id;
  if (sel) sel.value = id;
  openTeacherToolBuilder(id);
}
Object.assign(window, {
  openTeacherToolBuilder, openTeacherToolBuilderUI, closeTeacherToolBuilder,
  generateTeacherToolBuilder, applyTeacherToolBuilderToBoard, copyTeacherToolBuilderOutput
});
})();
