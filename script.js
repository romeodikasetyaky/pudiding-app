/** 1. KONFIGURASI SUPABASE & HELPER ZONA WAKTU */
const SUPABASE_URL = 'https://smbfunjcwevyzsolbspt.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_f3oGRQtQuvZd_Z2MVVsXKw_BzAyYbSN';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// NAMA MENU DIPERBARUI MENJADI "BIG"
const menus = {
    'qty-ori': { name: 'Puding Karamel', price: 8000 },
    'qty-regal': { name: 'Puding Karamel Regal', price: 10000 },
    'qty-oreo': { name: 'Puding Karamel Oreo', price: 11000 },
    'qty-karamel-500': { name: 'Puding Karamel Big', price: 42000 },
    'qty-regal-500': { name: 'Puding Regal Big', price: 50000 },
    'qty-oreo-500': { name: 'Puding Oreo Big', price: 55000 }
};

let menuChartInstance = null, paymentChartInstance = null, globalOrders = [], globalExpenses = [], idleTimer;

// FUNGSI PENGUNCI ZONA WAKTU LOKAL
function createLocalIsoString(dateStr, timeStr = null) {
    const d = new Date();
    if (!timeStr) {
        timeStr = [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0'), String(d.getSeconds()).padStart(2, '0')].join(':');
    }
    const tzo = -d.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const pad = num => String(num).padStart(2, '0');
    const off = dif + pad(Math.floor(Math.abs(tzo) / 60)) + ':' + pad(Math.abs(tzo) % 60);
    return `${dateStr}T${timeStr}${off}`; 
}

/** 2. LOGIN & SESI */
const INACTIVITY_LIMIT = 5 * 60 * 1000; 
function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (localStorage.getItem('puding_logged_in') === 'true') {
        idleTimer = setTimeout(() => handleLogout(), INACTIVITY_LIMIT);
    }
}
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => window.addEventListener(evt, resetIdleTimer));

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        checkSession();
        document.getElementById('loading-overlay').classList.add('hidden-force');
    }, 1000);
});

function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('username').value.trim().toLowerCase();
    const p = document.getElementById('password').value.trim().toLowerCase();
    if (u === 'puding' && p === 'karamel') { 
        localStorage.setItem('puding_logged_in', 'true'); 
        checkSession(); 
    } else { 
        showCustomAlert('Gagal', 'Username/Sandi salah.', 'error'); 
    }
}

function handleLogout() { localStorage.removeItem('puding_logged_in'); location.reload(); }

function checkSession() {
    const isLogin = localStorage.getItem('puding_logged_in') === 'true';
    const loginScr = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');

    if (isLogin) {
        loginScr.classList.add('hidden-force');
        mainApp.classList.remove('hidden-force');
        mainApp.classList.add('flex');
        lucide.createIcons(); initApp(); resetIdleTimer();
    } else {
        loginScr.classList.remove('hidden-force');
        mainApp.classList.add('hidden-force');
        mainApp.classList.remove('flex');
    }
}

/** 3. NAVIGASI */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden-force');
        el.classList.remove('block-force');
    });
    
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const target = document.getElementById(`page-${tabId}`);
    target.classList.remove('hidden-force');
    target.classList.add('block-force');
    
    document.getElementById(`nav-${tabId}`).classList.add('active');
    
    if (tabId === 'laporan') generateReport();
    lucide.createIcons();
}

function initApp() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    ['order-date', 'exp-date', 'filter-end'].forEach(id => document.getElementById(id).value = dateStr);
    
    const lastMonth = new Date(); lastMonth.setDate(lastMonth.getDate() - 30);
    const lm_yyyy = lastMonth.getFullYear();
    const lm_mm = String(lastMonth.getMonth() + 1).padStart(2, '0');
    const lm_dd = String(lastMonth.getDate()).padStart(2, '0');
    document.getElementById('filter-start').value = `${lm_yyyy}-${lm_mm}-${lm_dd}`;
    
    if(document.querySelectorAll('.expense-row').length === 0) addExpenseRow();
}

/** 4. FITUR KASIR */
function updateQty(id, change) {
    const el = document.getElementById(id);
    let cur = parseInt(el.innerText);
    if (cur + change >= 0) { el.innerText = cur + change; calculateTotal(); }
}

function calculateTotal() {
    let sub = 0;
    for (let id in menus) sub += parseInt(document.getElementById(id).innerText) * menus[id].price;
    const total = sub + (parseInt(document.getElementById('add-item-price').value) || 0);
    document.getElementById('total-price').innerText = total.toLocaleString('id-ID');
    return total;
}

async function generateOrderID(dateStr) {
    const startIso = createLocalIsoString(dateStr, "00:00:00");
    const endIso = createLocalIsoString(dateStr, "23:59:59");
    const { count } = await supabaseClient.from('pesanan').select('*', { count: 'exact', head: true })
        .gte('created_at', startIso).lte('created_at', endIso);
    const dd = dateStr.split('-')[2], mm = dateStr.split('-')[1];
    return `PDD${dd}${mm}${String((count || 0) + 1).padStart(2, '0')}`;
}

async function konfirmasiPesanan() {
    const total = calculateTotal(); if (total === 0) return alert("Pilih item!");
    const dateVal = document.getElementById('order-date').value; 
    const createdAtIso = createLocalIsoString(dateVal);

    const id = await generateOrderID(dateVal);
    const items = [];
    for (let key in menus) {
        let q = parseInt(document.getElementById(key).innerText);
        if (q > 0) items.push({ name: menus[key].name, qty: q, subtotal: q * menus[key].price });
    }
    const addPrice = parseInt(document.getElementById('add-item-price').value) || 0;
    if (addPrice > 0) items.push({ name: document.getElementById('add-item-name').value || 'Biaya Lain', qty: 1, subtotal: addPrice });

    const { error } = await supabaseClient.from('pesanan').insert([{ 
        no_pesanan: id, 
        total_harga: total, 
        metode_pembayaran: document.getElementById('payment-method').value, 
        detail_pesanan: items, 
        created_at: createdAtIso 
    }]);

    if (error) alert(error.message); else { showCustomAlert('Berhasil', 'Pesanan disimpan.'); closeReceipt(); }
}

/** 5. PENGELUARAN */
function addExpenseRow() {
    const rowId = Date.now();
    const html = `<div id="row-${rowId}" class="expense-row grid grid-cols-2 md:grid-cols-12 gap-3 p-4 bg-cream/10 rounded-xl border border-border">
        <div class="col-span-2 md:col-span-4"><input type="text" placeholder="Item" class="exp-item-name w-full h-11 bg-white border border-border rounded-lg px-3 font-bold"></div>
        <div class="col-span-1 md:col-span-2"><input type="number" placeholder="Qty" class="exp-item-qty w-full h-11 bg-white border border-border rounded-lg px-3" oninput="calcExpRow()"></div>
        <div class="col-span-1 md:col-span-2"><input type="number" placeholder="Harga" class="exp-item-price w-full h-11 bg-white border border-border rounded-lg px-3 font-bold" oninput="calcExpRow()"></div>
        <div class="col-span-1 md:col-span-3"><select class="exp-item-method w-full h-11 bg-white border border-border rounded-lg px-3 font-bold"><option value="Tunai">Tunai</option><option value="Transfer">Transfer</option><option value="QRIS">QRIS</option></select></div>
        <div class="col-span-1 md:col-span-1 flex justify-center"><button type="button" onclick="removeExpenseRow(${rowId})" class="text-red-500 hover:bg-red-50 p-2 rounded-lg"><i data-lucide="trash-2"></i></button></div>
    </div>`;
    document.getElementById('expense-items-container').insertAdjacentHTML('beforeend', html);
    lucide.createIcons();
}

function removeExpenseRow(id) { 
    if(document.querySelectorAll('.expense-row').length > 1) {
        document.getElementById(`row-${id}`).remove(); calcExpRow(); 
    }
}

function calcExpRow() {
    let all = 0;
    document.querySelectorAll('.expense-row').forEach(r => { all += (r.querySelector('.exp-item-qty').value || 0) * (r.querySelector('.exp-item-price').value || 0); });
    document.getElementById('exp-total-all').innerText = all.toLocaleString('id-ID');
}

async function simpanPengeluaran(e) {
    e.preventDefault();
    const date = document.getElementById('exp-date').value, dataToInsert = [];
    document.querySelectorAll('.expense-row').forEach(r => {
        const n = r.querySelector('.exp-item-name').value, q = parseInt(r.querySelector('.exp-item-qty').value), p = parseInt(r.querySelector('.exp-item-price').value), m = r.querySelector('.exp-item-method').value;
        if (n && q && p) dataToInsert.push({ tanggal: date, nama_item: n, qty: q, harga_satuan: p, total: q * p, metode_pembayaran: m });
    });
    if(dataToInsert.length === 0) return alert("Isi minimal 1 item.");
    const { error } = await supabaseClient.from('pengeluaran').insert(dataToInsert);
    if (error) alert(error.message); else { showCustomAlert('Berhasil', 'Belanja dicatat.'); document.getElementById('expense-items-container').innerHTML = ''; addExpenseRow(); calcExpRow(); }
}

/** 6. LAPORAN & SALDO BERSIH */
async function generateReport() {
    const s = document.getElementById('filter-start').value;
    const e = document.getElementById('filter-end').value;
    
    const startIso = createLocalIsoString(s, "00:00:00");
    const endIso = createLocalIsoString(e, "23:59:59");

    const { data: o } = await supabaseClient.from('pesanan').select('*').gte('created_at', startIso).lte('created_at', endIso);
    const { data: ex } = await supabaseClient.from('pengeluaran').select('*').gte('tanggal', s).lte('tanggal', e);
    
    globalOrders = o || []; globalExpenses = ex || [];
    updateUIReport(globalOrders, globalExpenses);
}

function updateUIReport(orders, expenses) {
    const tIn = orders.reduce((s, o) => s + Number(o.total_harga), 0), tOut = expenses.reduce((s, e) => s + Number(e.total), 0);
    document.getElementById('sum-income').innerText = 'Rp ' + tIn.toLocaleString('id-ID');
    document.getElementById('sum-expense').innerText = 'Rp ' + tOut.toLocaleString('id-ID');
    document.getElementById('sum-balance').innerText = 'Rp ' + (tIn - tOut).toLocaleString('id-ID');

    let oH = ''; orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(o => {
        const localObj = new Date(o.created_at);
        const localDateStr = `${localObj.getDate()}/${localObj.getMonth() + 1}/${localObj.getFullYear()}`;
        
        oH += `<tr><td class="p-4 font-bold">${localDateStr}</td><td class="p-4 text-right font-black">Rp ${o.total_harga.toLocaleString('id-ID')}</td><td class="p-4 text-center"><button onclick="bukaEditPesanan(${o.id})" class="text-blue-500 mr-2"><i data-lucide="pencil" class="w-4 h-4"></i></button><button onclick="hapusData('pesanan', ${o.id})" class="text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`;
    });
    document.getElementById('order-table-body').innerHTML = oH || '<tr><td colspan="3" class="p-4 text-center">Kosong</td></tr>';

    let eH = ''; expenses.sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal)).forEach(e => {
        eH += `<tr><td class="p-4">${e.tanggal}</td><td class="p-4">${e.nama_item} (x${e.qty})</td><td class="p-4 text-right font-black">Rp ${e.total.toLocaleString('id-ID')}</td><td class="p-4 text-center"><button onclick="bukaEditPengeluaran(${e.id})" class="text-blue-500 mr-2"><i data-lucide="pencil" class="w-4 h-4"></i></button><button onclick="hapusData('pengeluaran', ${e.id})" class="text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`;
    });
    document.getElementById('expense-table-body').innerHTML = eH || '<tr><td colspan="4" class="p-4 text-center">Kosong</td></tr>';
    lucide.createIcons(); renderCharts(orders, expenses);
}

function renderCharts(orders, expenses) {
    const ctxM = document.getElementById('menuChart').getContext('2d'), ctxP = document.getElementById('paymentChart').getContext('2d');
    if (menuChartInstance) menuChartInstance.destroy(); if (paymentChartInstance) paymentChartInstance.destroy();

    // NAMA LEGEND CHART SUDAH DIUPDATE MENJADI "BIG"
    let mD = { 'Puding Karamel': 0, 'Puding Karamel Regal': 0, 'Puding Karamel Oreo': 0, 'Puding Karamel Big': 0, 'Puding Regal Big': 0, 'Puding Oreo Big': 0 };
    let pIncome = { 'Tunai': 0, 'Transfer': 0, 'QRIS': 0 }, pExpense = { 'Tunai': 0, 'Transfer': 0, 'QRIS': 0 };

    orders.forEach(o => {
        if (o.detail_pesanan) {
            o.detail_pesanan.forEach(i => { 
                // KOMPATIBILITAS: Mengubah data lama "500ml" agar terbaca sebagai "Big"
                let n = i.name;
                if(n === 'Puding Karamel 500ml') n = 'Puding Karamel Big';
                if(n === 'Puding Regal 500ml') n = 'Puding Regal Big';
                if(n === 'Puding Oreo 500ml') n = 'Puding Oreo Big';
                
                if (mD[n] !== undefined) mD[n] += i.qty; 
            });
        }
        if (pIncome[o.metode_pembayaran] !== undefined) pIncome[o.metode_pembayaran] += o.total_harga;
    });
    expenses.forEach(e => { if (pExpense[e.metode_pembayaran] !== undefined) pExpense[e.metode_pembayaran] += e.total; });

    let pNet = { 'Tunai': pIncome.Tunai - pExpense.Tunai, 'Transfer': pIncome.Transfer - pExpense.Transfer, 'QRIS': pIncome.QRIS - pExpense.QRIS };

    let mHtml = '';
    for(let m in pNet) {
        let v = pNet[m], clr = v < 0 ? 'text-red-500' : 'text-emerald-600';
        mHtml += `<tr><td class="p-3 font-bold">${m}</td><td class="p-3 text-right font-black ${clr}">Rp ${v.toLocaleString('id-ID')}</td></tr>`;
    }
    document.getElementById('method-balance-table-body').innerHTML = mHtml;

    const opt = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } } } } };
    menuChartInstance = new Chart(ctxM, { type: 'doughnut', data: { labels: Object.keys(mD), datasets: [{ data: Object.values(mD), backgroundColor: ['#170C79', '#56B6C6', '#8ACBD0', '#F59E0B', '#EF4444', '#10B981'] }] }, options: opt });
    paymentChartInstance = new Chart(ctxP, { type: 'doughnut', data: { labels: ['Tunai', 'Transfer', 'QRIS'], datasets: [{ data: [Math.max(0, pNet.Tunai), Math.max(0, pNet.Transfer), Math.max(0, pNet.QRIS)], backgroundColor: ['#EFE3CA', '#56B6C6', '#170C79'] }] }, options: opt });
}

/** 7. LOGIKA EDIT */
function closeEditModal(id) { document.getElementById(id).classList.add('hidden-force'); }

function bukaEditPesanan(id) {
    const o = globalOrders.find(x => x.id === id); if(!o) return;
    
    const localObj = new Date(o.created_at);
    const dStr = `${localObj.getFullYear()}-${String(localObj.getMonth()+1).padStart(2,'0')}-${String(localObj.getDate()).padStart(2,'0')}`;
    const tStr = `${String(localObj.getHours()).padStart(2,'0')}:${String(localObj.getMinutes()).padStart(2,'0')}:${String(localObj.getSeconds()).padStart(2,'0')}`;

    document.getElementById('edit-order-id').value = o.id;
    document.getElementById('edit-order-time').value = tStr;
    document.getElementById('edit-order-date').value = dStr;
    document.getElementById('edit-order-method').value = o.metode_pembayaran;
    document.getElementById('edit-order-total').value = o.total_harga;
    document.getElementById('edit-order-modal').classList.remove('hidden-force');
}

async function simpanEditPesanan(e) {
    e.preventDefault();
    const id = document.getElementById('edit-order-id').value, m = document.getElementById('edit-order-method').value, t = parseInt(document.getElementById('edit-order-total').value), d = document.getElementById('edit-order-date').value, tm = document.getElementById('edit-order-time').value;
    const updatedCreatedAtIso = createLocalIsoString(d, tm);
    const { error } = await supabaseClient.from('pesanan').update({ total_harga: t, metode_pembayaran: m, created_at: updatedCreatedAtIso }).eq('id', id);
    if (!error) { showCustomAlert('Sukses', 'Data diubah.'); closeEditModal('edit-order-modal'); generateReport(); }
}

function bukaEditPengeluaran(id) {
    const e = globalExpenses.find(x => x.id === id); if(!e) return;
    document.getElementById('edit-expense-id').value = e.id;
    document.getElementById('edit-expense-date').value = e.tanggal;
    document.getElementById('edit-expense-name').value = e.nama_item;
    document.getElementById('edit-expense-qty').value = e.qty;
    document.getElementById('edit-expense-price').value = e.harga_satuan;
    document.getElementById('edit-expense-method').value = e.metode_pembayaran;
    document.getElementById('edit-expense-modal').classList.remove('hidden-force');
}

async function simpanEditPengeluaran(e) {
    e.preventDefault();
    const id = document.getElementById('edit-expense-id').value, d = document.getElementById('edit-expense-date').value, n = document.getElementById('edit-expense-name').value, q = parseInt(document.getElementById('edit-expense-qty').value), p = parseInt(document.getElementById('edit-expense-price').value), m = document.getElementById('edit-expense-method').value;
    const { error } = await supabaseClient.from('pengeluaran').update({ tanggal: d, nama_item: n, qty: q, harga_satuan: p, total: q*p, metode_pembayaran: m }).eq('id', id);
    if (!error) { showCustomAlert('Sukses', 'Data diubah.'); closeEditModal('edit-expense-modal'); generateReport(); }
}

/** 8. LAIN-LAIN */
function showCustomAlert(title, msg, type = 'success') {
    const b = document.getElementById('alert-box');
    document.getElementById('alert-icon').innerHTML = type === 'success' ? `<i data-lucide="check-circle" class="text-emerald-500 w-12 h-12"></i>` : `<i data-lucide="alert-circle" class="text-red-500 w-12 h-12"></i>`;
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = msg;
    b.classList.add('show'); lucide.createIcons();
}
function closeAlert() { document.getElementById('alert-box').classList.remove('show'); }

function hapusData(tabel, id) {
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');
    document.getElementById('confirm-ok').onclick = async () => {
        const { error } = await supabaseClient.from(tabel).delete().eq('id', id);
        modal.classList.add('hidden'); generateReport();
    };
    document.getElementById('confirm-cancel').onclick = () => modal.classList.add('hidden');
}

function closeReceipt() { 
    document.querySelectorAll('[id^="qty-"]').forEach(el => el.innerText = '0'); 
    document.getElementById('add-item-price').value = '0'; document.getElementById('add-item-name').value = '';
    calculateTotal(); 
}

function exportToExcel() {
    const ws = XLSX.utils.aoa_to_sheet([["LAPORAN KEUANGAN PUDIDING"]]), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `Laporan_Pudiding.xlsx`);
}

function exportToPDF() {
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.text("LAPORAN KEUANGAN PUDIDING", 14, 20);
    doc.save("Laporan_Pudiding.pdf");
}