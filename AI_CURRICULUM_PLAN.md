# TeachEd AI curriculum plan

## Now — reliable lesson packs

- Keep the internal curriculum pack available with no API key.
- Generate five-stage lesson arcs with skill-specific patterns.
- Include support, core and stretch routes, checks for understanding, teacher moves and reflection.
- Validate every remote response before it can be applied to a board.
- Cache identical requests and keep OpenRouter model selection budget-aware.

## Next — reusable teacher assets

- Save a generated plan as a named template with level, skill, audience and tags.
- Let teachers pin favourite frames, task patterns and correction moves.
- Add a “make easier / make harder / change context” operation that reuses the same lesson goal.
- Add answer keys and model responses as optional cards.

## Later — quality feedback loop

- Record lightweight teacher feedback (keep, edit, reject) without storing student PII.
- Use that feedback to re-rank local patterns and model candidates.
- Add golden lesson fixtures for every skill, mode and CEFR band.
- Expose generation health, cache hit rate and model cost estimates in admin diagnostics.

## Guardrails

- Never expose the OpenRouter key to the browser or commit it.
- Keep prompts short and model calls bounded by time, token and rate limits.
- Fall back locally on timeout, invalid JSON, low-quality content or provider errors.
