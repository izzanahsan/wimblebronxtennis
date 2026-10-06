// ── INSTAGRAM STORY ──────────────────────────────────────────
// Builds the end-of-day results image (story.js draws it).
let _shareDate  = null;   // league: which day to share
let _sharePhoto = null;   // HTMLImageElement picked by the user
let _shareSections = { podium: true, rows: true, matches: true };
let _shareBlob  = null;
let _shareUrl   = null;

function leagueShareDates() {
  return [...new Set(App.matches.filter(m => m.season_id === App.seasonId && m.status === 'done').map(m => m.date))]
    .sort().reverse();
}

// The data for the image, for whichever kind of event is open
function storyData() {
  const pName = id => player(id)?.name || '?';
  const pPhoto = id => player(id)?.photo_url || null;

  if (App.event.kind === 'day') {
    const st = dayStandings().filter(r => r.played);
    const done = App.matches.filter(m => m.status === 'done').sort((a, b) => a.round - b.round || a.court - b.court);
    return {
      title: App.event.name,
      subtitle: `Americano · ${formatDate(done[0]?.date || today())}`,
      podium: st.slice(0, 3).map(r => ({ name: pName(r.id), value: `${r.points} games`, photoUrl: pPhoto(r.id) })),
      rows: st.map((r, i) => ({ rank: i + 1, name: pName(r.id), value: String(r.points), sub: `${r.wins}W ${r.draws ? r.draws + 'D ' : ''}${r.losses}L` })),
      matches: done.map(m => ({ a: teamNames(m.team_a), b: teamNames(m.team_b), sa: m.score_a, sb: m.score_b, label: `R${m.round} · C${m.court}` }))
    };
  }

  // League: one day's matches, ranked by wins that day
  const dates = leagueShareDates();
  if (!dates.includes(_shareDate)) _shareDate = dates[0] || today();
  const ms = App.matches.filter(m => m.season_id === App.seasonId && m.status === 'done' && m.date === _shareDate)
    .sort((a, b) => a.id - b.id);
  const day = leagueTable(ms).filter(r => r.played)
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.gamesWon - a.gamesWon);
  const diff = d => d > 0 ? `+${d}` : String(d);
  return {
    title: App.event.name,
    subtitle: `${season()?.name || ''} · ${formatDate(_shareDate)}`,
    podium: day.slice(0, 3).map(r => ({ name: pName(r.id), value: `${r.wins}W ${diff(r.diff)}`, photoUrl: pPhoto(r.id) })),
    rows: day.map((r, i) => ({ rank: i + 1, name: pName(r.id), value: `${r.wins}W`, sub: `${r.played} played · ${diff(r.diff)}` })),
    matches: ms.map(m => ({ a: teamNames(m.team_a), b: teamNames(m.team_b), sa: m.score_a, sb: m.score_b }))
  };
}

function renderShare() {
  const isLeague = App.event.kind === 'league';
  const dates = isLeague ? leagueShareDates() : [];
  if (isLeague && !dates.includes(_shareDate)) _shareDate = dates[0] || null;
  const hasResults = isLeague ? dates.length > 0 : App.matches.some(m => m.status === 'done');

  const el = document.getElementById('view');
  if (!hasResults) {
    el.innerHTML = '<div class="empty">No finished matches yet — results will show up here for your story.</div>';
    return;
  }

  const toggle = (k, label) => `<button class="${_shareSections[k] ? 'active' : ''}" onclick="_shareSections.${k}=!_shareSections.${k};renderStoryPreview(true)">${label}</button>`;

  el.innerHTML = `
    <p class="section-title">📸 Story for Instagram</p>
    ${isLeague ? `
      <div class="input-group">
        <label class="input-label">Day</label>
        <select class="input" onchange="_shareDate=this.value;renderStoryPreview()">
          ${dates.map(d => `<option value="${d}" ${d === _shareDate ? 'selected' : ''}>${formatDate(d)}${d === today() ? ' (today)' : ''}</option>`).join('')}
        </select>
      </div>` : ''}

    <div class="card">
      <label class="btn btn-outline" style="display:block">
        ${_sharePhoto ? '🖼 Change background photo' : '🖼 Add your photo (group pic, court…)'}
        <input type="file" accept="image/*" style="display:none" onchange="pickSharePhoto(this.files[0])">
      </label>
      ${_sharePhoto ? `<button class="btn-mini mt-8" onclick="_sharePhoto=null;renderShare()">Remove photo</button>` : ''}
      <div class="flex-between mt-8">
        <span class="text-sm">Show</span>
        <div class="seg">${toggle('podium', 'Podium')}${toggle('rows', 'Standings')}${toggle('matches', 'Scores')}</div>
      </div>
    </div>

    <div class="story-preview-wrap"><div class="story-preview" id="story-preview"><div class="loading-spinner"></div></div></div>

    <button class="btn btn-green" id="story-share-btn" onclick="shareStory()" disabled>📤 Share to Instagram</button>
    <p class="text-sm text-muted mt-8" style="text-align:center">On your phone this opens the share sheet — pick Instagram → Story. Elsewhere it downloads the image.</p>
  `;
  renderStoryPreview();
}

async function pickSharePhoto(file) {
  if (!file) return;
  try {
    _sharePhoto = await loadImageFromFile(file);
    renderShare();
  } catch (e) { toast('❌ ' + e.message, 4000); }
}

let _previewSeq = 0;
async function renderStoryPreview(rerenderControls) {
  if (rerenderControls) { renderShare(); return; }
  const seq = ++_previewSeq;
  const btn = document.getElementById('story-share-btn');
  if (btn) btn.disabled = true;

  const d = storyData();
  const sections = ['podium', 'rows', 'matches'].filter(k => _shareSections[k]);
  const blob = await renderStory({ ...d, photo: _sharePhoto, sections, footer: 'wimblebronx' });
  if (seq !== _previewSeq) return; // a newer render started

  _shareBlob = blob;
  if (_shareUrl) URL.revokeObjectURL(_shareUrl);
  _shareUrl = URL.createObjectURL(blob);
  const box = document.getElementById('story-preview');
  if (box) box.innerHTML = `<img src="${_shareUrl}" alt="Story preview">`;
  if (btn) btn.disabled = false;
}

async function shareStory() {
  if (!_shareBlob) return;
  const name = `${App.event.name}-${App.event.kind === 'league' ? _shareDate : today()}`.replace(/[^\w-]+/g, '-').toLowerCase();
  const res = await shareOrDownload(_shareBlob, name + '.png');
  if (res === 'downloaded') toast('⬇️ Image saved — post it from your gallery');
}
