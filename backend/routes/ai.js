const express = require('express');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { generateLesson, status } = require('../lib/ai');

const router = express.Router();
router.use(requireAuth, requireTeacher);

router.get('/status', (_req, res) => res.json(status()));

router.post('/generate', async (req, res) => {
  try {
    const result = await generateLesson(req.body || {}, req.user.id);
    res.json(result);
  } catch (error) {
    if (error.code === 'AI_RATE_LIMIT') return res.status(429).json({ error: error.message });
    console.error('[ai]', error.message);
    res.status(500).json({ error: 'Generation failed. The local fallback is available in the board.' });
  }
});

module.exports = router;
