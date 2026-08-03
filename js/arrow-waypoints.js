/* Arrow waypoints + endpoint re-anchor drag — ported from teachedos into teached
   (branch merge/teachedos-features). Loaded AFTER the main inline script; it
   monkey-patches window.renderAllArrows with the waypoint-aware version and adds
   the supporting drag handlers. Depends on board globals already present in teached:
   state, arrowsSvg, boardWrap, ctxMenu, boardToWrap, getAnchorBoardPos, screenToBoard,
   nearestCardAnchor, getCardEl, makeArrowPath, snapshot, scheduleSave. */
(function(){
'use strict';

// ── endpoint resolution (supports free endpoints via fromPoint/toPoint) ──
function _arrowEndpoint(arrow, side) {
  if (side === 'from') {
    if (arrow.fromCard) {
      const c = state.cards.find(c => c.id === arrow.fromCard);
      return c ? getAnchorBoardPos(c, arrow.fromAnchor) : null;
    }
    return arrow.fromPoint ? { x: arrow.fromPoint.x, y: arrow.fromPoint.y } : null;
  } else {
    if (arrow.toCard) {
      const c = state.cards.find(c => c.id === arrow.toCard);
      return c ? getAnchorBoardPos(c, arrow.toAnchor) : null;
    }
    return arrow.toPoint ? { x: arrow.toPoint.x, y: arrow.toPoint.y } : null;
  }
}
// Effective anchor used by the bezier/elbow routers — fall back to 'auto'
// when an endpoint is free (no card-side anchor).
function _arrowEffectiveAnchor(arrow, side) {
  if (side === 'from') return arrow.fromCard ? arrow.fromAnchor : 'auto';
  return arrow.toCard ? arrow.toAnchor : 'auto';
}

// ── waypoint-aware path builder (wraps the existing makeArrowPath) ──
function makeArrowPathThroughWaypoints(fw, tw, waypointsBoard, fromAnchor, toAnchor, route) {
  if (!waypointsBoard || !waypointsBoard.length) {
    return makeArrowPath(fw.x, fw.y, tw.x, tw.y, fromAnchor, toAnchor, route);
  }
  const wps = waypointsBoard.map(p => boardToWrap(p.x, p.y));
  const points = [fw, ...wps, tw];
  if (route === 'straight' || route === 'elbow') {
    // straight: simple polyline; elbow: 90° between each pair
    if (route === 'straight') {
      return points.map((p,i) => (i?'L':'M') + p.x + ',' + p.y).join(' ');
    }
    // elbow: alternate horizontal/vertical between waypoints
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i-1], cur = points[i];
      // simple: go horizontal first then vertical
      d += ` L${cur.x},${prev.y} L${cur.x},${cur.y}`;
    }
    return d;
  }
  // Curve: Catmull-Rom through all points (similar to stroke smoothing)
  if (points.length < 3) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// ── endpoint + waypoint drag state & handlers ──
let _arrowDrag = null; // { arrow, side, handle, snapEl }

function _beginArrowEndpointDrag(e, arrowId, side, handle) {
  e.stopPropagation();
  e.preventDefault();
  const arrow = state.arrows.find(a => a.id === arrowId);
  if (!arrow) return;
  snapshot(); // capture pre-drag state once
  handle.classList.add('dragging');
  _arrowDrag = { arrow, side, handle, snapEl: null };
  window.addEventListener('mousemove', _onArrowEndpointDragMove, true);
  window.addEventListener('mouseup', _endArrowEndpointDrag, true);
}

function _onArrowEndpointDragMove(e) {
  if (!_arrowDrag) return;
  const { arrow, side } = _arrowDrag;
  const pos = screenToBoard(e.clientX, e.clientY);
  // Is the cursor over a card? If so, snap to nearest anchor.
  const cardEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.board-card');
  if (cardEl) {
    const card = state.cards.find(c => c.id === cardEl.dataset.id);
    if (card) {
      const anchor = nearestCardAnchor(card, e.clientX, e.clientY);
      // Provisional snap to card
      if (side === 'from') {
        arrow.fromCard = card.id; arrow.fromAnchor = anchor;
        delete arrow.fromPoint;
      } else {
        arrow.toCard = card.id; arrow.toAnchor = anchor;
        delete arrow.toPoint;
      }
      renderAllArrows();
      return;
    }
  }
  // Otherwise: free point under cursor
  if (side === 'from') {
    arrow.fromPoint = { x: pos.x, y: pos.y };
    delete arrow.fromCard; delete arrow.fromAnchor;
  } else {
    arrow.toPoint = { x: pos.x, y: pos.y };
    delete arrow.toCard; delete arrow.toAnchor;
  }
  renderAllArrows();
}

function _endArrowEndpointDrag(e) {
  if (!_arrowDrag) return;
  window.removeEventListener('mousemove', _onArrowEndpointDragMove, true);
  window.removeEventListener('mouseup', _endArrowEndpointDrag, true);
  _arrowDrag.handle.classList.remove('dragging');
  _arrowDrag = null;
  scheduleSave && scheduleSave();
  if (typeof _broadcastArrowsSoon === 'function') _broadcastArrowsSoon();
}

/* ── Arrow waypoint drag ── */
let _arrowWpDrag = null; // { arrow, idx, handle }
function _beginArrowWaypointDrag(e, arrowId, idx, handle) {
  e.stopPropagation();
  e.preventDefault();
  const arrow = state.arrows.find(a => a.id === arrowId);
  if (!arrow || !arrow.waypoints) return;
  snapshot();
  handle.classList.add('dragging');
  _arrowWpDrag = { arrow, idx, handle };
  window.addEventListener('mousemove', _onArrowWaypointDragMove, true);
  window.addEventListener('mouseup', _endArrowWaypointDrag, true);
}
function _onArrowWaypointDragMove(e) {
  if (!_arrowWpDrag) return;
  const { arrow, idx } = _arrowWpDrag;
  const pos = screenToBoard(e.clientX, e.clientY);
  arrow.waypoints[idx] = { x: pos.x, y: pos.y };
  renderAllArrows();
}
function _endArrowWaypointDrag() {
  if (!_arrowWpDrag) return;
  window.removeEventListener('mousemove', _onArrowWaypointDragMove, true);
  window.removeEventListener('mouseup', _endArrowWaypointDrag, true);
  _arrowWpDrag.handle.classList.remove('dragging');
  _arrowWpDrag = null;
  scheduleSave && scheduleSave();
}

/* Add waypoint on double-click anywhere along the arrow's hit-path */
function _addArrowWaypointAt(arrowId, sx, sy) {
  const arrow = state.arrows.find(a => a.id === arrowId);
  if (!arrow) return;
  snapshot();
  const p = screenToBoard(sx, sy);
  arrow.waypoints = arrow.waypoints || [];
  // Insert at end (a simple model — works fine for one or two waypoints)
  arrow.waypoints.push({ x: p.x, y: p.y });
  state.selectedArrows.add(arrow.id);
  renderAllArrows();
  scheduleSave && scheduleSave();
}

// ── waypoint-aware renderAllArrows (overrides the base one) ──
function renderAllArrows() {
  // Remove existing rendered arrows
  arrowsSvg.querySelectorAll('.arrow-group').forEach(g => g.remove());

  const r = boardWrap.getBoundingClientRect();

  state.arrows.forEach(arrow => {
    const from = _arrowEndpoint(arrow, 'from');
    const to   = _arrowEndpoint(arrow, 'to');
    if (!from || !to) return;

    const fromAnchor = _arrowEffectiveAnchor(arrow, 'from');
    const toAnchor   = _arrowEffectiveAnchor(arrow, 'to');

    const fw = boardToWrap(from.x, from.y);
    const tw = boardToWrap(to.x,   to.y);

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.classList.add('arrow-group');
    g.dataset.arrowId = arrow.id;
    g.style.pointerEvents = 'all';

    const route = arrow.route || 'curve';
    const wps = Array.isArray(arrow.waypoints) ? arrow.waypoints : [];
    const dPath = makeArrowPathThroughWaypoints(fw, tw, wps, fromAnchor, toAnchor, route);
    // Hit area (wider invisible path)
    const hit = document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('d', dPath);
    hit.style.cssText = 'fill:none;stroke:transparent;stroke-width:12;cursor:pointer;pointer-events:stroke;';
    hit.addEventListener('click', e => {
      e.stopPropagation();
      state.selectedArrows.add(arrow.id);
      path.classList.add('selected-arrow');
      // Re-render so endpoint drag handles appear on this arrow
      renderAllArrows();
    });
    hit.addEventListener('dblclick', e => {
      e.stopPropagation();
      _addArrowWaypointAt(arrow.id, e.clientX, e.clientY);
    });
    hit.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      ctxArrowId = arrow.id;
      document.getElementById('ctx-delete-arrow').style.display = '';
      document.getElementById('ctx-toggle-prereq').style.display = '';
      document.getElementById('ctx-label-arrow').style.display = '';
      document.getElementById('ctx-arrow-sep').style.display = '';
      document.getElementById('ctx-toggle-prereq').textContent =
        arrow.type === 'prereq' ? '🔗 Make Regular Arrow' : '🔒 Make Prereq Arrow';
      // Show style controls for regular arrows
      const styleWrap = document.getElementById('ctx-arrow-style-wrap');
      if (styleWrap) {
        styleWrap.style.display = arrow.type === 'prereq' ? 'none' : '';
        const cs = arrow.style || 'solid', cd = arrow.direction || 'forward';
        const cr = arrow.route || 'curve';
        const cc = arrow.color || '#5E5E4A';
        ['solid','dashed','dotted'].forEach(s => document.getElementById('cas-'+s)?.classList.toggle('active', s===cs));
        ['forward','both','backward','none'].forEach(d => document.getElementById('cad-'+d)?.classList.toggle('active', d===cd));
        ['curve','straight','elbow'].forEach(r => document.getElementById('car-'+r)?.classList.toggle('active', r===cr));
        document.querySelectorAll('.cac-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.c === cc));
      }
      ctxMenu.style.left = e.clientX+'px'; ctxMenu.style.top = e.clientY+'px';
      ctxMenu.style.display = 'block';
    });

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.classList.add('arrow-path');
    path.setAttribute('d', dPath);
    if (arrow.color) path.setAttribute('stroke', arrow.color);

    // Style based on arrow type
    if (arrow.type === 'prereq') {
      const fromCardData = state.cards.find(c => c.id === arrow.fromCard);
      const isDone   = fromCardData?.data?.status === 'done';
      const isLocked = !fromCardData || fromCardData.data?.status === 'locked';
      path.classList.add('prereq');
      if (isDone)        path.classList.add('done');
      else if (isLocked) path.classList.add('locked');
      path.setAttribute('marker-end', isDone ? 'url(#arrowhead-prereq-done)' : 'url(#arrowhead-prereq)');
    } else {
      const dir = arrow.direction || 'forward';
      if (dir === 'forward' || dir === 'both') path.setAttribute('marker-end','url(#arrowhead)');
      if (dir === 'backward' || dir === 'both') path.setAttribute('marker-start','url(#arrowhead-start)');
      if (dir === 'none') { path.removeAttribute('marker-end'); path.removeAttribute('marker-start'); }
    }
    // Dash style
    if (arrow.style === 'dashed') path.style.strokeDasharray = '8 4';
    else if (arrow.style === 'dotted') path.style.strokeDasharray = '2 5';
    else path.style.strokeDasharray = '';
    if (state.selectedArrows.has(arrow.id)) path.classList.add('selected-arrow');

    g.appendChild(hit);
    g.appendChild(path);

    // Endpoint drag-handles (only on selected arrows)
    if (state.selectedArrows.has(arrow.id)) {
      ['from','to'].forEach(side => {
        const pt = side === 'from' ? fw : tw;
        const handle = document.createElementNS('http://www.w3.org/2000/svg','circle');
        handle.classList.add('arrow-endpoint-handle');
        handle.setAttribute('cx', pt.x);
        handle.setAttribute('cy', pt.y);
        handle.setAttribute('r', 6);
        handle.dataset.arrowId = arrow.id;
        handle.dataset.side = side;
        handle.addEventListener('mousedown', e => _beginArrowEndpointDrag(e, arrow.id, side, handle));
        g.appendChild(handle);
      });
      // Mid-line waypoint handles — drag to bend the arrow, double-click to remove
      wps.forEach((wp, idx) => {
        const wpW = boardToWrap(wp.x, wp.y);
        const wh = document.createElementNS('http://www.w3.org/2000/svg','circle');
        wh.classList.add('arrow-waypoint-handle');
        wh.setAttribute('cx', wpW.x);
        wh.setAttribute('cy', wpW.y);
        wh.setAttribute('r', 5);
        wh.dataset.arrowId = arrow.id;
        wh.dataset.wpIdx = idx;
        wh.addEventListener('mousedown', e => _beginArrowWaypointDrag(e, arrow.id, idx, wh));
        wh.addEventListener('dblclick', e => {
          e.stopPropagation();
          snapshot();
          arrow.waypoints.splice(idx, 1);
          if (!arrow.waypoints.length) delete arrow.waypoints;
          renderAllArrows();
          scheduleSave && scheduleSave();
        });
        g.appendChild(wh);
      });
    }

    // Arrow label
    if (arrow.label) {
      const d = dPath;
      // midpoint approximation
      const mx = (fw.x + tw.x) / 2, my = (fw.y + tw.y) / 2;
      const fo = document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
      fo.setAttribute('x', mx - 40); fo.setAttribute('y', my - 12);
      fo.setAttribute('width', 80); fo.setAttribute('height', 24);
      fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="
        background:rgba(255,255,255,.92);border:1px solid rgba(94,94,74,.2);border-radius:6px;
        padding:2px 7px;font-size:10px;font-weight:700;color:#3A3A2E;
        font-family:'SFMono-Regular', 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;text-align:center;white-space:nowrap;
        overflow:hidden;text-overflow:ellipsis;">${arrow.label}</div>`;
      g.appendChild(fo);
    }

    arrowsSvg.appendChild(g);
  });
}

// Override the global renderer + expose the double-click add handler.
window.renderAllArrows = renderAllArrows;
window._addArrowWaypointAt = _addArrowWaypointAt;
// Re-render once so existing arrows pick up the new renderer.
try { if (typeof state !== 'undefined' && state && Array.isArray(state.arrows)) renderAllArrows(); } catch (e) {}
})();
