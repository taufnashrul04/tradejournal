const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let editingId = null;
let currentBuktiUrl = null;
let journalId = null;

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const TYPE_LABELS = { prop:'Prop Firm', forex:'Forex', crypto:'Crypto Perp', saham:'Saham', demo:'Demo', custom:'Lainnya' };

// Auth guard + load journal dari URL
sb.auth.getSession().then(({ data: { session } }) => {
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
  document.getElementById('nav-username').textContent = username;

  const params = new URLSearchParams(window.location.search);
  journalId = params.get('j');
  if (!journalId) { window.location.href = 'dashboard.html'; return; }

  loadJournalInfo();
  loadTrades();
});

let journalData = null;

async function loadJournalInfo() {
  const { data, error } = await sb.from('journals').select('*').eq('id', journalId).single();
  if (error || !data) { window.location.href = 'dashboard.html'; return; }
  journalData = data;

  document.title = `${data.name} - Trading Journal`;
  document.getElementById('j-title').textContent = data.name;
  document.getElementById('j-emoji-icon').textContent = data.emoji;
  document.getElementById('j-emoji-icon').style.background = `${data.color}22`;
  document.getElementById('j-emoji-icon').style.borderColor = `${data.color}33`;

  const badge = document.getElementById('j-type-badge');
  badge.textContent = TYPE_LABELS[data.type] || data.type;
  badge.style.color = data.color;
  badge.style.borderColor = `${data.color}33`;
  badge.style.background = `${data.color}11`;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

// Load & filter trades
async function loadTrades() {
  const filterMonth = document.getElementById('filter-month').value;
  const filterHasil = document.getElementById('filter-hasil').value;
  const filterPosisi = document.getElementById('filter-posisi').value;

  let query = sb.from('trades').select('*')
    .eq('user_id', currentUser.id)
    .eq('journal_id', journalId)
    .order('tanggal', { ascending: false })
    .order('id', { ascending: false });

  if (filterMonth) {
    const [year, month] = filterMonth.split('-');
    const from = `${year}-${month}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${month}-${lastDay}`;
    query = query.gte('tanggal', from).lte('tanggal', to);
  }
  if (filterHasil) query = query.eq('hasil', filterHasil);
  if (filterPosisi) query = query.eq('posisi', filterPosisi);

  const { data, error } = await query;
  if (error) { console.error(error); return; }

  renderTable(data || []);
  renderStats(data || []);
}

function renderTable(trades) {
  const tbody = document.getElementById('trade-body');
  if (!trades.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">Belum ada trade di journal ini</td></tr>';
    return;
  }

  tbody.innerHTML = trades.map((t, i) => {
    const tgl = new Date(t.tanggal + 'T00:00:00');
    const hariTgl = `${HARI[tgl.getDay()]}, ${tgl.toLocaleDateString('id-ID')}`;
    const pnlClass = t.pnl > 0 ? 'pnl-pos' : t.pnl < 0 ? 'pnl-neg' : '';
    const hasilClass = t.hasil === 'Win' ? 'badge-win' : t.hasil === 'Loss' ? 'badge-loss' : 'badge-be';
    const posisiClass = t.posisi === 'Long' ? 'badge-long' : 'badge-short';
    const buktiHtml = t.bukti_url
      ? `<button class="btn-img" onclick="previewImg('${t.bukti_url}')">Lihat</button>`
      : '<span style="color:var(--text3)">-</span>';

    return `<tr>
      <td class="no-cell">${i + 1}</td>
      <td>${hariTgl}</td>
      <td>${t.entry_model || '<span style="color:var(--text3)">-</span>'}</td>
      <td class="pair-cell">${t.pair}</td>
      <td>${t.session || '<span style="color:var(--text3)">-</span>'}</td>
      <td>${t.timeframe || '<span style="color:var(--text3)">-</span>'}</td>
      <td>${t.posisi ? `<span class="badge ${posisiClass}">${t.posisi}</span>` : '<span style="color:var(--text3)">-</span>'}</td>
      <td>${t.hasil ? `<span class="badge ${hasilClass}">${t.hasil}</span>` : '<span style="color:var(--text3)">-</span>'}</td>
      <td class="${pnlClass}">${t.pnl != null ? (t.pnl > 0 ? '+' : '') + Number(t.pnl).toFixed(2) : '<span style="color:var(--text3)">-</span>'}</td>
      <td>${buktiHtml}</td>
      <td>
        <button class="btn-edit" onclick="editTrade(${t.id})">Edit</button>
        <button class="btn-del" onclick="deleteTrade(${t.id})">Hapus</button>
      </td>
    </tr>`;
  }).join('');
}

function renderStats(trades) {
  const wins = trades.filter(t => t.hasil === 'Win').length;
  const losses = trades.filter(t => t.hasil === 'Loss').length;
  const totalPnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const winrate = trades.length ? Math.round((wins / trades.length) * 100) : 0;

  document.getElementById('stat-total').textContent = trades.length;
  document.getElementById('stat-win').textContent = wins;
  document.getElementById('stat-loss').textContent = losses;
  document.getElementById('stat-pnl').textContent = (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(2);
  document.getElementById('stat-winrate').textContent = winrate + '%';

  const pnlCard = document.getElementById('stat-pnl').parentElement;
  pnlCard.classList.toggle('pnl-pos', totalPnl > 0);
  pnlCard.classList.toggle('pnl-neg', totalPnl < 0);

  // Tampilkan balance sekarang jika balance awal diset
  if (journalData?.balance_awal) {
    const balNow = journalData.balance_awal + totalPnl;
    const pct = ((totalPnl / journalData.balance_awal) * 100).toFixed(1);
    const pctStr = (totalPnl >= 0 ? '+' : '') + pct + '%';
    document.getElementById('stat-total').closest('.stats-row')
      .querySelectorAll('.stat-card')[0]
      .querySelector('.stat-label').textContent = 'Balance Awal';
    document.getElementById('stat-total').textContent = '$' + Number(journalData.balance_awal).toLocaleString();

    // Ganti label PNL card jadi "Balance Skrg"
    const pnlLabel = pnlCard.querySelector('.stat-label');
    pnlLabel.textContent = 'Balance Skrg';
    document.getElementById('stat-pnl').textContent = '$' + balNow.toFixed(0);

    // Tampilkan profit% di winrate card bila tidak ada filter
    const wrLabel = document.getElementById('stat-winrate').parentElement.querySelector('.stat-label');
    wrLabel.textContent = 'Profit';
    document.getElementById('stat-winrate').textContent = pctStr;
    document.getElementById('stat-winrate').style.color = totalPnl >= 0 ? 'var(--win)' : 'var(--loss)';

    // Ganti label Win card jadi "Trade"
    document.getElementById('stat-win').parentElement.querySelector('.stat-label').textContent = 'Trade';
    document.getElementById('stat-win').textContent = trades.length;
    document.getElementById('stat-win').style.color = 'var(--text)';

    // Ganti label Loss card jadi "Win Rate"
    document.getElementById('stat-loss').parentElement.querySelector('.stat-label').textContent = 'Win Rate';
    document.getElementById('stat-loss').textContent = winrate + '%';
    document.getElementById('stat-loss').style.color = 'var(--accent)';
  }
}

// Modal trade
function openModal(trade = null) {
  editingId = null;
  currentBuktiUrl = null;
  document.getElementById('trade-form').reset();
  document.getElementById('bukti-preview').classList.add('hidden');
  document.getElementById('bukti-img').src = '';

  if (trade) {
    editingId = trade.id;
    currentBuktiUrl = trade.bukti_url;
    document.getElementById('modal-title').textContent = 'Edit Trade';
    document.getElementById('f-tanggal').value = trade.tanggal;
    document.getElementById('f-entry-model').value = trade.entry_model || '';
    document.getElementById('f-pair').value = trade.pair;
    document.getElementById('f-session').value = trade.session || '';
    document.getElementById('f-timeframe').value = trade.timeframe || '';
    document.getElementById('f-posisi').value = trade.posisi || '';
    document.getElementById('f-hasil').value = trade.hasil || '';
    document.getElementById('f-pnl').value = trade.pnl != null ? trade.pnl : '';
    document.getElementById('f-catatan').value = trade.catatan || '';
    if (trade.bukti_url) {
      document.getElementById('bukti-img').src = trade.bukti_url;
      document.getElementById('bukti-preview').classList.remove('hidden');
    }
  } else {
    document.getElementById('modal-title').textContent = 'Tambah Trade';
    document.getElementById('f-tanggal').value = new Date().toISOString().split('T')[0];
  }

  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }
function closeModalOutside(e) { if (e.target === document.getElementById('modal')) closeModal(); }

function clearBukti() {
  document.getElementById('f-bukti').value = '';
  document.getElementById('bukti-img').src = '';
  document.getElementById('bukti-preview').classList.add('hidden');
  currentBuktiUrl = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-bukti').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('bukti-img').src = ev.target.result;
        document.getElementById('bukti-preview').classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });
});

async function saveTrade(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-loading').classList.remove('hidden');

  const tanggal = document.getElementById('f-tanggal').value;
  const hari = HARI[new Date(tanggal + 'T00:00:00').getDay()];

  let buktiUrl = currentBuktiUrl;
  const fileInput = document.getElementById('f-bukti');
  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    const ext = file.name.split('.').pop();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await sb.storage.from('bukti').upload(path, file);
    if (uploadErr) { alert('Gagal upload: ' + uploadErr.message); resetSaveBtn(); return; }
    const { data: urlData } = sb.storage.from('bukti').getPublicUrl(path);
    buktiUrl = urlData.publicUrl;
  }

  const pnlVal = document.getElementById('f-pnl').value;
  const payload = {
    user_id: currentUser.id,
    journal_id: Number(journalId),
    tanggal,
    hari,
    entry_model: document.getElementById('f-entry-model').value || null,
    pair: document.getElementById('f-pair').value,
    session: document.getElementById('f-session').value || null,
    timeframe: document.getElementById('f-timeframe').value || null,
    posisi: document.getElementById('f-posisi').value || null,
    hasil: document.getElementById('f-hasil').value || null,
    pnl: pnlVal !== '' ? parseFloat(pnlVal) : null,
    bukti_url: buktiUrl,
    catatan: document.getElementById('f-catatan').value || null,
  };

  let error;
  if (editingId) {
    ({ error } = await sb.from('trades').update(payload).eq('id', editingId));
  } else {
    ({ error } = await sb.from('trades').insert(payload));
  }

  if (error) { alert('Gagal menyimpan: ' + error.message); }
  else { closeModal(); loadTrades(); }
  resetSaveBtn();
}

function resetSaveBtn() {
  const btn = document.getElementById('btn-save');
  btn.disabled = false;
  btn.querySelector('.btn-text').classList.remove('hidden');
  btn.querySelector('.btn-loading').classList.add('hidden');
}

async function editTrade(id) {
  const { data, error } = await sb.from('trades').select('*').eq('id', id).single();
  if (!error && data) openModal(data);
}

async function deleteTrade(id) {
  if (!confirm('Hapus trade ini?')) return;
  const { error } = await sb.from('trades').delete().eq('id', id);
  if (!error) loadTrades();
}

function previewImg(url) {
  document.getElementById('img-modal-src').src = url;
  document.getElementById('img-modal').classList.remove('hidden');
}

function closeImgModal() {
  document.getElementById('img-modal').classList.add('hidden');
  document.getElementById('img-modal-src').src = '';
}
