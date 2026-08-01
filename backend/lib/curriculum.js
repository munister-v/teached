// Internal curriculum pack. Kept local so generation remains useful without a model/API.
const CEFR = {
  A1: { verbs: ['identify', 'match', 'repeat', 'choose'], outcomes: ['name familiar items', 'answer with a short phrase', 'follow a simple model'] },
  A2: { verbs: ['describe', 'compare', 'ask', 'complete'], outcomes: ['give a short description', 'join a guided exchange', 'write connected sentences'] },
  B1: { verbs: ['explain', 'justify', 'summarise', 'rephrase'], outcomes: ['support an opinion with a reason', 'summarise the main idea', 'repair a communication gap'] },
  B2: { verbs: ['evaluate', 'challenge', 'synthesise', 'qualify'], outcomes: ['develop a nuanced argument', 'respond to an alternative view', 'use evidence precisely'] },
  C1: { verbs: ['critique', 'distinguish', 'infer', 'refine'], outcomes: ['handle implicit meaning', 'control register and stance', 'produce a coherent extended response'] },
};

const SKILLS = {
  Writing: {
    targets: ['thesis', 'evidence', 'counterargument', 'cohesion', 'paragraph', 'example', 'revise', 'clarity', 'register', 'stance', 'hedging', 'conclusion'],
    frames: ['Claim → reason → evidence → link', 'Although X, Y because Z', 'This suggests that…', 'A stronger example would…', 'The qualification is important because…'],
    tasks: ['model-text noticing', 'sentence-combining', 'paragraph architecture', 'peer-review ladder', 'timed response', 'rewrite for register', 'counterargument swap'],
    errors: ['unclear thesis', 'unsupported claim', 'repetition', 'weak cohesion', 'informal register', 'overgeneralisation'],
  },
  Speaking: {
    targets: ['opinion', 'follow-up', 'fluency', 'intonation', 'agree', 'clarify', 'negotiate', 'reaction', 'turn-taking', 'stance', 'repair', 'register'],
    frames: ['I see your point, but…', 'What makes you say that?', 'Could you give an example?', 'If I understand you correctly…', 'That depends on whether…'],
    tasks: ['opinion line', 'information gap', 'role-play ladder', 'speed-dating prompts', 'decision task', 'mini-presentation', 'fishbowl discussion'],
    errors: ['one-word answers', 'no follow-up', 'hesitation loops', 'flat intonation', 'L1 translation', 'interrupting'],
  },
  Vocabulary: {
    targets: ['collocation', 'word family', 'context', 'meaning', 'retrieve', 'sort', 'synonym', 'use', 'register', 'connotation', 'chunk', 'pronunciation'],
    frames: ['It is often used with…', 'In this context it means…', 'A more formal alternative is…', 'The opposite/converse is…', 'I can use it when…'],
    tasks: ['context detective', 'word-family grid', 'retrieval race', 'collocation dominoes', 'sorting challenge', 'personalised sentences', 'four corners'],
    errors: ['translation-only recall', 'wrong word form', 'false friend', 'missing collocation', 'spelling', 'stress placement'],
  },
  Grammar: {
    targets: ['pattern', 'form', 'meaning', 'auxiliary', 'word order', 'contrast', 'self-correct', 'accuracy', 'reference', 'aspect', 'modality', 'condition'],
    frames: ['Notice what changes when…', 'The speaker chooses this form to…', 'If…, then…', 'It would be more natural to say…', 'Check the auxiliary and main verb.'],
    tasks: ['guided discovery', 'concept-check questions', 'micro-drills', 'error auction', 'reformulation relay', 'controlled-to-free task', 'grammar gallery'],
    errors: ['word order', 'missing auxiliary', 'tense inconsistency', 'article choice', 'agreement', 'overusing a safe form'],
  },
  Reading: {
    targets: ['predict', 'gist', 'detail', 'inference', 'scan', 'evidence', 'context', 'summarise', 'tone', 'purpose', 'reference', 'structure'],
    frames: ['The headline suggests…', 'The evidence for this is…', 'The writer implies rather than states…', 'This paragraph functions to…', 'In other words…'],
    tasks: ['prediction grid', 'gist race', 'evidence hunt', 'paragraph jigsaw', 'writer-intent debate', 'summary ladder', 'quote-to-claim match'],
    errors: ['reading every word', 'unsupported inference', 'confusing detail and main idea', 'ignoring reference words', 'copying instead of summarising'],
  },
  Listening: {
    targets: ['predict', 'gist', 'detail', 'signpost', 'intonation', 'note-taking', 'confirm', 'transfer', 'attitude', 'sequence', 'reduction', 'repair'],
    frames: ['I heard the speaker emphasise…', 'The signpost tells us that…', 'The attitude sounds… because…', 'I missed the detail, but the context suggests…', 'Can you confirm the sequence?'],
    tasks: ['prediction pause', 'first-listen gist', 'second-listen detail', 'dictogloss', 'sound-to-meaning sort', 'note reconstruction', 'transfer debate'],
    errors: ['trying to decode every word', 'missing signposts', 'confusing speaker attitude', 'incomplete notes', 'not using context'],
  },
};

const MODES = {
  'lesson-board': ['hook', 'input', 'controlled practice', 'freer task', 'reflection'],
  'quick-activities': ['fast opener', 'one-minute model', 'pair rotation', 'challenge round', 'exit ticket'],
  'homework-pack': ['brief', 'model answer', 'guided attempt', 'independent task', 'self-check'],
  'mistake-clinic': ['diagnose', 'notice', 'repair', 'retest', 'transfer'],
  'game-pack': ['warm-up game', 'matching round', 'speed round', 'challenge round', 'student-created round'],
};

const TEACHER_MOVES = ['model one example', 'ask a concept-check question', 'give wait time', 'recast before explaining', 'pair students before whole-class feedback', 'collect one strong example and one repair', 'end with a visible exit ticket'];

module.exports = { CEFR, SKILLS, MODES, TEACHER_MOVES };
