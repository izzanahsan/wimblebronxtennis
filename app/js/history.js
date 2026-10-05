// ── MATCH HISTORY ────────────────────────────────────────────
function renderHistory() {
  updateSessionBtn();
  const el      = document.getElementById('match-history-list');
  const matches = seasonMatches(state.currentSeason).slice().reverse();

  if (!matches.length) {
    el.innerHTML = '<div class="empty">No matches yet this season.</div>';
    return;
  }

  const total = matches.length;

  el.innerHTML = matches.map((m, i) => {
    const na     = m.teamA.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
    const nb     = m.teamB.map(id => state.allPlayers.find(p => p.id === id)?.name || '?').join(' & ');
    const locked = isDateLocked(m.date);
    const fmtStr = m.format ? formatLabel(m.format) : '';

    return `
    <div class="match-card ${locked ? 'locked' : ''}">
      <div class="match-meta">
        <span>Match #${total - i} · ${formatDate(m.date)}${fmtStr ? ' · ' + fmtStr : ''}${locked ? ' 🔒' : ''}</span>
        ${locked
          ? `<span style="font-size:10px;color:var(--green-light);cursor:pointer" onclick="toggleSessionLock()">🔓 Unlock</span>`
          : `<button onclick="deleteMatch(${m.id})" style="background:none;border:none;color:#EF4444;font-size:18px;cursor:pointer;padding:4px 8px;line-height:1">🗑</button>`}
      </div>
      <div class="match-body">
        <div class="match-team">
          <div class="match-team-names">${na}</div>
          <span class="tag-pill ${m.winner === 'A' ? 'tag-win' : 'tag-loss'}">${m.winner === 'A' ? 'WIN' : 'LOSS'}</span>
        </div>
        <div class="match-score-block">
          <div class="match-score">
            <span class="${m.winner === 'A' ? 'score-win' : 'score-lose'}">${m.gamesA}</span>
            <span style="color:var(--text-muted)"> – </span>
            <span class="${m.winner === 'B' ? 'score-win' : 'score-lose'}">${m.gamesB}</span>
          </div>
          <div class="match-label">GAMES</div>
        </div>
        <div class="match-team" style="text-align:right">
          <div class="match-team-names">${nb}</div>
          <span class="tag-pill ${m.winner === 'B' ? 'tag-win' : 'tag-loss'}">${m.winner === 'B' ? 'WIN' : 'LOSS'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── SESSION LOCK ─────────────────────────────────────────────
function updateSessionBtn() {
  const btn    = document.getElementById('session-btn');
  if (!btn) return;
  const locked = isDateLocked(today());
  btn.textContent        = locked ? '🔓 Unlock Today' : '🔒 End Session';
  btn.style.borderColor  = locked ? 'var(--green)' : '';
  btn.style.color        = locked ? 'var(--green-light)' : '';
}

async function toggleSessionLock() {
  const t = today();
  if (isDateLocked(t)) {
    await sb.from('locked_dates').delete().eq('date', t);
    state.lockedDates = state.lockedDates.filter(d => d !== t);
  } else {
    const n = seasonMatches(state.currentSeason).filter(m => m.date === t).length;
    if (!n) { toast('⚠️ No matches today to lock.'); return; }
    await sb.from('locked_dates').insert({ date: t });
    state.lockedDates.push(t);
  }
  renderHistory();
}

// ── DELETE MATCH ─────────────────────────────────────────────
let _deleteMatchId = null;

function deleteMatch(id) {
  const m = state.matches.find(x => x.id === id);
  if (!m) return;
  _deleteMatchId = id;

  const na = m.teamA.map(i => state.allPlayers.find(p => p.id === i)?.name || '?').join(' & ');
  const nb = m.teamB.map(i => state.allPlayers.find(p => p.id === i)?.name || '?').join(' & ');
  document.getElementById('modal-delete-match-desc').textContent = `${na}  ${m.gamesA}–${m.gamesB}  ${nb}`;
  openModal('modal-delete-match');
}

async function confirmDeleteMatch() {
  if (_deleteMatchId === null) return;
  const id = _deleteMatchId;
  _deleteMatchId = null;
  closeModal('modal-delete-match');

  await sb.from('matches').delete().eq('id', id);
  state.matches = state.matches.filter(m => m.id !== id);
  renderHistory();
  updateHeader();
}
