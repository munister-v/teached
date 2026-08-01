const assert = require('assert');
const { localLesson, normalizeInput } = require('../lib/ai');

const skills = ['Writing', 'Speaking', 'Vocabulary', 'Grammar', 'Reading', 'Listening'];
for (const skill of skills) {
  const input = normalizeInput({ skill, level: 'B2', mode: 'lesson-board', topic: `${skill} strategy and practice` });
  const plan = localLesson(input);
  assert.equal(plan.stages.length, 5, `${skill}: five stages`);
  assert(plan.vocabulary.length >= 8, `${skill}: vocabulary`);
  assert(plan.differentiation.support.length && plan.differentiation.stretch.length, `${skill}: differentiation`);
  assert(plan.checks.length >= 3, `${skill}: checks`);
}
console.log(`AI curriculum smoke passed for ${skills.length} skills`);
