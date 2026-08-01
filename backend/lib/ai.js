const crypto = require('crypto');

const BASE_URL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const MODEL_TTL = Math.max(15 * 60_000, Number(process.env.OPENROUTER_MODEL_TTL_MS || 21_600_000));
const MAX_MODEL_COST = Number(process.env.OPENROUTER_MAX_COST || 0.8);
const TTL = Math.max(30_000, Number(process.env.AI_CACHE_TTL_MS || 600_000));
const MAX_CACHE = Math.max(8, Number(process.env.AI_CACHE_MAX || 64));
const WINDOW = 10 * 60 * 1000;
const MAX_REQUESTS = Math.max(1, Number(process.env.AI_MAX_REQUESTS || 8));
const cache = new Map();
const usage = new Map();
const pending = new Map();
let modelCatalog = { expires: 0, models: [] };
let modelCatalogPromise = null;
const modelHealth = new Map();

const DICTIONARY = {
  Writing: ['thesis', 'evidence', 'counterargument', 'cohesion', 'paragraph', 'example', 'revise', 'clarity'],
  Speaking: ['opinion', 'follow-up', 'fluency', 'intonation', 'agree', 'clarify', 'negotiate', 'reaction'],
  Vocabulary: ['collocation', 'word family', 'context', 'meaning', 'retrieve', 'sort', 'synonym', 'use'],
  Grammar: ['pattern', 'form', 'meaning', 'auxiliary', 'word order', 'contrast', 'self-correct', 'accuracy'],
  Reading: ['predict', 'gist', 'detail', 'inference', 'scan', 'evidence', 'context', 'summarise'],
  Listening: ['predict', 'gist', 'detail', 'signpost', 'intonation', 'note-taking', 'confirm', 'transfer'],
};

function clean(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeInput(input = {}) {
  const skills = Object.keys(DICTIONARY);
  const skill = skills.includes(input.skill) ? input.skill : 'Writing';
  const modes = ['lesson-board', 'quick-activities', 'homework-pack', 'mistake-clinic', 'game-pack'];
  return {
    provider: ['local', 'openrouter', 'balanced'].includes(input.provider) ? input.provider : 'balanced',
    mode: modes.includes(input.mode) ? input.mode : 'lesson-board',
    level: clean(input.level, 8) || 'B1',
    duration: clean(input.duration, 12) || '45 min',
    skill,
    audience: clean(input.audience, 40) || 'Teens',
    topic: clean(input.topic, 180) || 'A practical English lesson',
    teacherMemory: clean(input.teacherMemory, 500),
    studentMemory: clean(input.studentMemory, 500),
    mistakes: clean(input.mistakes, 500),
    source: clean(input.source, 1800),
  };
}

function wordsFrom(text, min = 4, limit = 8) {
  return String(text || '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/)
    .filter(w => w.length >= min).slice(0, limit);
}

function localLesson(raw) {
  const input = normalizeInput(raw);
  const minutes = Math.max(20, Math.min(180, parseInt(input.duration, 10) || 45));
  const warm = Math.max(5, Math.round(minutes * .12));
  const lead = Math.max(8, Math.round(minutes * .22));
  const practice = Math.max(12, Math.round(minutes * .30));
  const output = Math.max(10, Math.round(minutes * .25));
  const reflect = Math.max(4, minutes - warm - lead - practice - output);
  const recipes = {
    Writing: ['model text noticing', 'argument builder', 'guided paragraph', 'peer upgrade'],
    Speaking: ['opinion line', 'useful phrases', 'role-play ladder', 'fluency reflection'],
    Vocabulary: ['meaning from context', 'word families', 'retrieval game', 'personalised sentences'],
    Grammar: ['guided discovery', 'micro-drills', 'error correction', 'communicative task'],
    Reading: ['prediction', 'gist scan', 'detail challenge', 'discussion transfer'],
    Listening: ['prediction', 'first-listen gist', 'second-listen details', 'speaking transfer'],
  };
  const recipe = recipes[input.skill];
  const topicWords = wordsFrom(input.topic, 4, 8);
  const contextWords = wordsFrom(`${input.source} ${input.mistakes}`, 5, 8);
  const vocabulary = [...new Set([...DICTIONARY[input.skill], ...topicWords, ...contextWords])].slice(0, 12);
  const mistakes = input.mistakes.split(/[,;\n]/).map(s => clean(s, 80)).filter(Boolean).slice(0, 6);
  const context = input.studentMemory ? ` Adapt examples to ${input.studentMemory}.` : '';
  const title = `${input.level} ${input.skill}: ${input.topic}`;
  return {
    provider: 'local', mode: input.mode, title,
    summary: `${input.duration} ${input.mode.replace('-', ' ')} for ${input.audience}. The flow moves from noticing to controlled practice, then a realistic output task.${context}`,
    stages: [
      { time: `${warm} min`, title: 'Hook + goal', goal: 'Activate context and make the outcome visible.', activity: `Students respond to a quick prompt about “${input.topic}” and set one personal target.` },
      { time: `${lead} min`, title: 'Input + noticing', goal: `Build core ${input.skill.toLowerCase()} language.`, activity: `Use a short model and highlight ${recipe[0]} patterns. Check meaning, form and one likely error.` },
      { time: `${practice} min`, title: 'Controlled practice', goal: 'Move from recognition to accurate production.', activity: `Complete an ${recipe[1]} task, compare in pairs and repair one answer. ${mistakes[0] ? `Target: ${mistakes[0]}.` : ''}` },
      { time: `${output} min`, title: input.mode === 'game-pack' ? 'Game challenge' : 'Freer task', goal: 'Use the target language in a realistic classroom product.', activity: `Pairs complete a ${recipe[2]} task and upgrade it with a mini-checklist.${context}` },
      { time: `${reflect} min`, title: 'Reflection + homework', goal: 'Lock in progress and set the next step.', activity: `Students choose one item to reuse and complete ${recipe[3]}. Homework: a short response using five target items.` },
    ],
    vocabulary,
    memoryHints: [input.teacherMemory && `Teacher style: ${input.teacherMemory}`, input.studentMemory && `Class profile: ${input.studentMemory}`, mistakes.length && `Target mistakes: ${mistakes.join(', ')}`].filter(Boolean),
    mistakeItems: mistakes,
    modeAddons: input.mode === 'game-pack' ? ['Matching round', 'Sorting round', 'Challenge round', 'Student-created round'] : ['Warm-up', 'Input', 'Practice', 'Production', 'Reflection', 'Homework'],
    warmupPrompts: [`What do you already know about ${input.topic}?`, 'What is one mistake people make with this topic?', 'Write one useful question for a partner.'],
    assessmentCriteria: [input.skill === 'Writing' ? 'Clear position and logical paragraphing' : 'Clear message and active participation', `Accurate use of ${vocabulary.slice(0, 3).join(', ')}`, mistakes[0] ? `Avoid: ${mistakes[0]}` : 'Self-correct at least one sentence'],
    teacherScript: [`Today we are training ${input.skill.toLowerCase()} through ${input.topic}.`, 'First notice, then practise safely, then use it in a real task.'],
    challenge: 'Fast finishers add one advanced phrase and one follow-up question.',
    teacherTip: input.teacherMemory ? 'Keep the saved teacher style visible while correcting.' : 'Save teacher memory to make the next board more personal.',
    homework: `Write or record a short response using at least 5 target items from “${input.topic}”.`,
  };
}

function validLesson(result) {
  if (!(result && typeof result === 'object' && clean(result.title, 240).length > 4 && Array.isArray(result.stages) && result.stages.length >= 3 && result.stages.every(s => s && clean(s.title, 120) && clean(s.activity, 600)))) return false;
  const text = [result.title, result.summary, ...result.stages.map(s => `${s.title} ${s.goal || ''} ${s.activity}`), ...(result.vocabulary || [])].join(' ');
  return text.length >= 420 && new Set(result.stages.map(s => clean(s.title, 100).toLowerCase())).size >= Math.min(4, result.stages.length);
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry || entry.expires < Date.now()) { cache.delete(key); return null; }
  cache.delete(key); cache.set(key, entry);
  return { ...entry.value, meta: { ...(entry.value.meta || {}), cached: true } };
}

function cacheSet(key, value) {
  cache.set(key, { value, expires: Date.now() + TTL });
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
}

function allow(userId) {
  const now = Date.now();
  const list = (usage.get(userId) || []).filter(ts => ts > now - WINDOW);
  if (list.length >= MAX_REQUESTS) return false;
  list.push(now); usage.set(userId, list); return true;
}

function promptFor(input) {
  return `Create a practical ${input.duration} ${input.level} English ${input.skill} lesson for ${input.audience}. Topic: ${input.topic}. Mode: ${input.mode}. Teacher memory: ${input.teacherMemory || 'none'}. Student memory: ${input.studentMemory || 'none'}. Mistakes: ${input.mistakes || 'none'}. Source: ${input.source || 'none'}. Return ONLY valid JSON with keys title, summary, stages (array of 5 objects with time,title,goal,activity), vocabulary (array), warmupPrompts (array), assessmentCriteria (array), homework, teacherTip, mistakeItems (array), memoryHints (array). Keep activities concrete, age-appropriate and non-repetitive.`;
}

function numericCost(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 99;
}

function modelScore(model, input) {
  const id = String(model.id || '').toLowerCase();
  const prompt = numericCost(model.pricing?.prompt);
  const completion = numericCost(model.pricing?.completion);
  const context = Number(model.context_length || 0);
  if (prompt > MAX_MODEL_COST || completion > MAX_MODEL_COST || context < 4000) return -Infinity;
  // Prefer small, instruction-following models for lesson JSON. The score deliberately
  // rewards low price first, then context and known reliable families.
  let score = 100 - (prompt * 40 + completion * 80);
  if (/free|:free$/.test(id)) score += 16;
  if (/flash|mini|small|haiku|8b|7b|instruct/.test(id)) score += 12;
  if (/gemini|qwen|llama|mistral|deepseek/.test(id)) score += 5;
  if (/vision|audio|tts|embedding|image|guard|moderation/.test(id)) score -= 80;
  if (input.source.length > 900 && context >= 16000) score += 8;
  if (input.skill === 'Writing' && /qwen|gemini|llama/.test(id)) score += 3;
  const health = modelHealth.get(model.id);
  if (health && health.cooldownUntil > Date.now()) return -Infinity;
  if (health) score -= Math.min(20, health.failures * 4);
  return score;
}

async function fetchModelCatalog() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return [];
  if (modelCatalog.expires > Date.now()) return modelCatalog.models;
  if (modelCatalogPromise) return modelCatalogPromise;
  modelCatalogPromise = fetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${key}`, 'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://teached.tech', 'X-Title': process.env.OPENROUTER_TITLE || 'TeachEd' },
    signal: AbortSignal.timeout(5000),
  }).then(response => response.ok ? response.json() : { data: [] })
    .then(payload => {
      modelCatalog.models = Array.isArray(payload.data) ? payload.data : [];
      modelCatalog.expires = Date.now() + MODEL_TTL;
      return modelCatalog.models;
    }).catch(() => modelCatalog.models)
    .finally(() => { modelCatalogPromise = null; });
  return modelCatalogPromise;
}

async function chooseModel(input) {
  const forced = String(process.env.OPENROUTER_MODEL || '').trim();
  if (forced) return forced;
  const models = await fetchModelCatalog();
  const ranked = models.map(model => ({ model, score: modelScore(model, input) }))
    .filter(item => item.score > -Infinity)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.model?.id || 'google/gemini-2.0-flash-001';
}

async function chooseModels(input) {
  const forced = String(process.env.OPENROUTER_MODEL || '').trim();
  if (forced) return [forced];
  const models = await fetchModelCatalog();
  return models.map(model => ({ model, score: modelScore(model, input) }))
    .filter(item => item.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.model.id);
}

function markModel(model, ok) {
  const current = modelHealth.get(model) || { failures: 0, cooldownUntil: 0 };
  if (ok) {
    current.failures = Math.max(0, current.failures - 1);
    current.cooldownUntil = 0;
  } else {
    current.failures += 1;
    current.cooldownUntil = Date.now() + Math.min(30 * 60_000, 30_000 * (2 ** Math.min(current.failures, 6)));
  }
  modelHealth.set(model, current);
}

async function callOpenRouter(input, model) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://teached.tech', 'X-Title': process.env.OPENROUTER_TITLE || 'TeachEd' },
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are a careful curriculum designer. Never invent unsafe or discriminatory content. Output compact, valid JSON only.' }, { role: 'user', content: promptFor(input) }] }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) return null;
        const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, ''));
        if (!validLesson(parsed)) { markModel(model, false); return null; }
        markModel(model, true);
        return { ...parsed, provider: 'openrouter', meta: { provider: 'openrouter', model, cached: false, usage: data.usage || null } };
      }
      // Retry only transient upstream failures; never spend twice on a bad request or rate limit.
      if (response.status < 500 || attempt === 1) { markModel(model, false); return null; }
      await new Promise(resolve => setTimeout(resolve, 220));
    } catch {
      if (attempt === 1) { markModel(model, false); return null; }
    } finally { clearTimeout(timer); }
  }
  return null;
}

async function generateLesson(raw, userId = 'anonymous') {
  const input = normalizeInput(raw);
  if (!allow(userId)) { const err = new Error('AI rate limit reached. Try again in a few minutes.'); err.code = 'AI_RATE_LIMIT'; throw err; }
  const models = input.provider === 'local' ? ['local'] : (await chooseModels(input));
  if (!models.length && input.provider !== 'local') models.push(await chooseModel(input));
  const model = models[0];
  const key = crypto.createHash('sha256').update(JSON.stringify({ ...input, model })).digest('hex');
  const cached = cacheGet(key); if (cached) return cached;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    let result = null;
    if (input.provider !== 'local') {
      for (const candidate of models) {
        result = await callOpenRouter(input, candidate);
        if (result) break;
      }
    }
    if (!result) {
      result = localLesson(input);
      result.meta = { provider: 'local', model: null, cached: false, fallback: input.provider !== 'local' && Boolean(process.env.OPENROUTER_API_KEY), selectedModel: model };
    }
    cacheSet(key, result); return result;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

function status() { return { configured: Boolean(process.env.OPENROUTER_API_KEY), model: process.env.OPENROUTER_MODEL || 'auto', localFallback: true, cache: cache.size, catalogFresh: modelCatalog.expires > Date.now(), catalogSize: modelCatalog.models.length }; }

module.exports = { generateLesson, status, normalizeInput, localLesson };
