const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let editingId = null;
let currentBuktiUrl = null;

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Auth guard
sb.auth.getSession().then(({ data: { session } }) => {
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = session.user;
  const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
  document.getElementById('nav-username').textContent = username;
  loadTrades();
});

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

// Load & filter trades
async function loadTrades() {
  const filterMonth = document.getElementById('filter-month').value;
  const filterHasil = document.getElementById('filter-hasil').value;
  const filterPosisi = document.getElementById('filter-posisi').value;

  let query = sb.from('trades').select('*').eq('user_id', currentUser.id).order('tanggal', { ascending: false }).order('id', { ascending: false });

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
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">Belum ada data trade</td></tr>';
    return;
  }

  tbody.innerHTML = trades.map((t, i) => {
    const tgl = new Date(t.tanggal + 'T00:00:00');
    const hariTgl = `${HARI[tgl.getDay()]}, ${tgl.toLocaleDateString('id-ID')}`;
    const pnlClass = t.pnl > 0 ? 'pnl-pos' : t.pnl < 0 ? 'pnl-neg' : '';
    const hasilClass = t.hasil === 'Win' ? 'badge-win' : t.hasil === 'Loss' ? 'badge-loss' : 'badge-be';
    const posisiClass = t.posisi === 'Long' ? 'badge-long' : t.posisi === 'Short' ? 'badge-short' : '';
    const buktiHtml = t.bukti_url
      ? `<button class="btn-img" onclick="previewImg('${t.bukti_url}')">Lihat</button>`
      : '-';

    return `<tr>
      <td>${i + 1}</td>
      <td>${hariTgl}</td>
      <td>${t.entry_model || '-'}</td>
      <td class="pair-cell">${t.pair}</td>
      <td>${t.session || '-'}</td>
      <td>${t.timeframe || '-'}</td>
      <td>${t.posisi ? `<span class="badge ${posisiClass}">${t.posisi}</span>` : '-'}</td>
      <td>${t.hasil ? `<span class="badge ${hasilClass}">${t.hasil}</span>` : '-'}</td>
      <td class="${pnlClass}">${t.pnl != null ? (t.pnl > 0 ? '+' : '') + Number(t.pnl).toFixed(2) : '-'}</td>
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

  const pnlEl = document.getElementById('stat-pnl').parentElement;
  pnlEl.classList.toggle('pnl-pos', totalPnl > 0);
  pnlEl.classList.toggle('pnl-neg', totalPnl < 0);
}

// Modal
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
    document.getElementById('trade-id').value = trade.id;
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

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

function clearBukti() {
  document.getElementById('f-bukti').value = '';
  document.getElementById('bukti-img').src = '';
  document.getElementById('bukti-preview').classList.add('hidden');
  currentBuktiUrl = null;
}

// File preview saat pilih
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

// Save trade
async function saveTrade(e) {
  e.preventDefault();
  const btnSave = document.getElementById('btn-save');
  btnSave.disabled = true;
  btnSave.querySelector('.btn-text').classList.add('hidden');
  btnSave.querySelector('.btn-loading').classList.remove('hidden');

  const tanggal = document.getElementById('f-tanggal').value;
  const tglDate = new Date(tanggal + 'T00:00:00');
  const hari = HARI[tglDate.getDay()];

  let buktiUrl = currentBuktiUrl;

  // Upload gambar jika ada file baru
  const fileInput = document.getElementById('f-bukti');
  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    const ext = file.name.split('.').pop();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    const { data: uploadData, error: uploadErr } = await sb.storage.from('bukti').upload(path, file);
    if (uploadErr) {
      alert('Gagal upload gambar: ' + uploadErr.message);
      resetSaveBtn();
      return;
    }
    const { data: urlData } = sb.storage.from('bukti').getPublicUrl(path);
    buktiUrl = urlData.publicUrl;
  }

  const pnlVal = document.getElementById('f-pnl').value;
  const payload = {
    user_id: currentUser.id,
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

  if (error) {
    alert('Gagal menyimpan: ' + error.message);
  } else {
    closeModal();
    loadTrades();
  }
  resetSaveBtn();
}

function resetSaveBtn() {
  const btn = document.getElementById('btn-save');
  btn.disabled = false;
  btn.querySelector('.btn-text').classList.remove('hidden');
  btn.querySelector('.btn-loading').classList.add('hidden');
}

// Edit trade
async function editTrade(id) {
  const { data, error } = await sb.from('trades').select('*').eq('id', id).single();
  if (error || !data) return;
  openModal(data);
}

// Delete trade
async function deleteTrade(id) {
  if (!confirm('Hapus trade ini?')) return;
  const { error } = await sb.from('trades').delete().eq('id', id);
  if (!error) loadTrades();
}

// Preview gambar
function previewImg(url) {
  document.getElementById('img-modal-src').src = url;
  document.getElementById('img-modal').classList.remove('hidden');
}

function closeImgModal() {
  document.getElementById('img-modal').classList.add('hidden');
  document.getElementById('img-modal-src').src = '';
}
