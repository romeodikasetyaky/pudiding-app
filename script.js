/** 1. KONFIGURASI AWAL */
const SUPABASE_URL = 'https://smbfunjcwevyzsolbspt.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_f3oGRQtQuvZd_Z2MVVsXKw_BzAyYbSN';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const menus = {
    'qty-ori': { name: 'Puding Karamel', price: 8000 },
    'qty-regal': { name: 'Puding Karamel Regal', price: 10000 },
    'qty-oreo': { name: 'Puding Karamel Oreo', price: 11000 },
    'qty-karamel-500': { name: 'Puding Karamel 500ml', price: 42000 },
    'qty-regal-500': { name: 'Puding Regal 500ml', price: 50000 },
    'qty-oreo-500': { name: 'Puding Oreo 500ml', price: 55000 }
};

let menuChartInstance = null;
let paymentChartInstance = null;
let globalOrders = []; 
let globalExpenses = []; 
let idleTimer;

/** 2. LOGIKA LOGIN & SESI */
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
        document.getElementById('loading-overlay').style.opacity = '0';
        setTimeout(() => document.getElementById('loading-overlay').classList.add('hidden-force'), 500);
    }, 1000);
});

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value.trim().toLowerCase();
    const pass = document.getElementById('password').value.trim().toLowerCase();

    if (user === 'puding' && pass === 'karamel') {
        localStorage.setItem('puding_logged_in', 'true');
        checkSession();
    } else {
        showCustomAlert('Akses Gagal', 'Username/Password salah.', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('puding_logged_in');
    location.reload(); 
}

function checkSession() {
    const isLogin = localStorage.getItem('puding_logged_in') === 'true';
    const loginScr = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');

    if (isLogin) {
        loginScr.classList.add('hidden-force');
        loginScr.classList.remove('flex');
        mainApp.classList.remove('hidden-force');
        mainApp.classList.add('flex'); 
        lucide.createIcons();
        initApp();
        resetIdleTimer();
    } else {
        loginScr.classList.remove('hidden-force');
        loginScr.classList.add('flex');
        mainApp.classList.add('hidden-force');
        mainApp.classList.remove('flex');
    }
}

/** 3. UI HELPERS & NAVIGATION */
function showCustomAlert(title, message, type = 'success') {
    const alertBox = document.getElementById('alert-box');
    document.getElementById('alert-icon').innerHTML = type === 'success' 
        ? `<i data-lucide="check-circle" class="w-16 h-14 text-emerald-500"></i>` 
        : `<i data-lucide="alert-circle" class="w-16 h-14 text-red-500"></i>`;
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = message;
    alertBox.classList.add('show');
    lucide.createIcons();
}
function closeAlert() { document.getElementById('alert-box').classList.remove('show'); }

function customConfirm(callback) {
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');
    document.getElementById('confirm-ok').onclick = () => { modal.classList.add('hidden'); callback(); };
    document.getElementById('confirm-cancel').onclick = () => modal.classList.add('hidden');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden-force');
        el.classList.remove('block-force');
    });
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(`page-${tabId}`).classList.remove('hidden-force');
    document.getElementById(`page-${tabId}`).classList.add('block-force');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    
    if (tabId === 'laporan') generateReport();
    lucide.createIcons();
}

function initApp() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('order-date').value = today;
    document.getElementById('exp-date').value = today;
    
    const lastMonth = new Date(); lastMonth.setDate(new Date().getDate() - 30);
    document.getElementById('filter-start').valueAsDate = lastMonth;
    document.getElementById('filter-end').valueAsDate = new Date();

    if(document.querySelectorAll('.expense-row').length === 0) addExpenseRow();
}

/** 4. KASIR LOGIC */
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
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const { count } = await supabaseClient.from('pesanan').select('*', { count: 'exact', head: true })
        .gte('created_at', `${dateStr}T00:00:00Z`).lte('created_at', `${dateStr}T23:59:59Z`);
    return `PDD${dd}${mm}${String((count || 0) + 1).padStart(2, '0')}`;
}

async function konfirmasiPesanan() {
    const total = calculateTotal();
    if (total === 0) return showCustomAlert('Kosong', 'Pilih item.', 'error');
    const date = document.getElementById('order-date').value;
    const id = await generateOrderID(date);
    const items = [];
    for (let key in menus) {
        let q = parseInt(document.getElementById(key).innerText);
        if (q > 0) items.push({ name: menus[key].name, qty: q, subtotal: q * menus[key].price });
    }
    const addPrice = parseInt(document.getElementById('add-item-price').value) || 0;
    if (addPrice > 0) items.push({ name: document.getElementById('add-item-name').value || 'Tambahan', qty: 1, subtotal: addPrice });

    const { error } = await supabaseClient.from('pesanan').insert([{ 
        no_pesanan: id, total_harga: total, metode_pembayaran: document.getElementById('payment-method').value, 
        detail_pesanan: items, created_at: `${date}T${new Date().toTimeString().split(' ')[0]}Z` 
    }]);

    if (error) showCustomAlert('Gagal', error.message, 'error');
    else { showCustomAlert('Berhasil', `ID: ${id}`); tampilkanStruk(id, new Date(date), items, total, document.getElementById('payment-method').value); }
}

/** 5. PENGELUARAN LOGIC */
function addExpenseRow() {
    const container = document.getElementById('expense-items-container');
    const rowId = Date.now();
    const html = `
        <div id="row-${rowId}" class="expense-row grid grid-cols-12 gap-3 items-center p-4 bg-cream/10 rounded-xl border border-border">
            <div class="col-span-5 text-primary"><input type="text" placeholder="Item" class="exp-item-name w-full h-11 bg-white border border-border rounded-lg px-3 text-sm outline-none font-bold"></div>
            <div class="col-span-2 text-primary"><input type="number" placeholder="Qty" class="exp-item-qty w-full h-11 bg-white border border-border rounded-lg px-3 text-sm outline-none" oninput="calcExpRow()"></div>
            <div class="col-span-3 text-primary"><input type="number" placeholder="Harga" class="exp-item-price w-full h-11 bg-white border border-border rounded-lg px-3 text-sm outline-none font-bold" oninput="calcExpRow()"></div>
            <div class="col-span-2 flex justify-center"><button type="button" onclick="removeExpenseRow(${rowId})" class="p-2 text-red-500 hover:bg-red-50 rounded-lg"><i data-lucide="trash-2"></i></button></div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    lucide.createIcons();
}

function removeExpenseRow(id) {
    const rows = document.querySelectorAll('.expense-row');
    if (rows.length > 1) { document.getElementById(`row-${id}`).remove(); calcExpRow(); }
}

function calcExpRow() {
    let all = 0;
    document.querySelectorAll('.expense-row').forEach(r => { all += (r.querySelector('.exp-item-qty').value || 0) * (r.querySelector('.exp-item-price').value || 0); });
    document.getElementById('exp-total-all').innerText = all.toLocaleString('id-ID');
}

async function simpanPengeluaran(e) {
    e.preventDefault();
    const date = document.getElementById('exp-date').value;
    const method = document.getElementById('exp-method').value;
    const rows = document.querySelectorAll('.expense-row');
    const dataToInsert = [];
    rows.forEach(r => {
        const n = r.querySelector('.exp-item-name').value;
        const q = parseInt(r.querySelector('.exp-item-qty').value);
        const p = parseInt(r.querySelector('.exp-item-price').value);
        if (n && q && p) dataToInsert.push({ tanggal: date, nama_item: n, qty: q, harga_satuan: p, total: q * p, metode_pembayaran: method });
    });
    if (dataToInsert.length === 0) return showCustomAlert('Ops', 'Isi minimal 1 item.', 'error');
    
    const { error } = await supabaseClient.from('pengeluaran').insert(dataToInsert);
    if (error) showCustomAlert('Gagal', error.message, 'error');
    else { showCustomAlert('Berhasil', 'Pengeluaran dicatat.'); document.getElementById('expense-items-container').innerHTML = ''; addExpenseRow(); calcExpRow(); }
}

/** 6. LAPORAN & CHARTS */
async function generateReport() {
    const s = document.getElementById('filter-start').value;
    const e = document.getElementById('filter-end').value;
    const { data: o } = await supabaseClient.from('pesanan').select('*').gte('created_at', s + 'T00:00:00Z').lte('created_at', e + 'T23:59:59Z');
    const { data: ex } = await supabaseClient.from('pengeluaran').select('*').gte('tanggal', s).lte('tanggal', e);
    globalOrders = o || []; globalExpenses = ex || [];
    updateUIReport(globalOrders, globalExpenses);
}

function updateUIReport(orders, expenses) {
    const tIn = orders.reduce((s, o) => s + Number(o.total_harga), 0);
    const tOut = expenses.reduce((s, e) => s + Number(e.total), 0);
    document.getElementById('sum-income').innerText = 'Rp ' + tIn.toLocaleString('id-ID');
    document.getElementById('sum-expense').innerText = 'Rp ' + tOut.toLocaleString('id-ID');
    document.getElementById('sum-balance').innerText = 'Rp ' + (tIn - tOut).toLocaleString('id-ID');

    // Menambahkan tombol edit (pencil icon) pada tabel Pesanan
    let oH = ''; orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).forEach(o => {
        oH += `<tr><td class="p-4 font-bold text-primary">${new Date(o.created_at).toLocaleDateString('id-ID')}</td><td class="p-4 font-black text-right">Rp ${o.total_harga.toLocaleString('id-ID')}</td><td class="p-4 text-center flex justify-center gap-1"><button onclick="bukaEditPesanan(${o.id})" class="text-blue-500 p-1 hover:bg-blue-50 rounded"><i data-lucide="pencil"></i></button><button onclick="cetakStrukUlang('${o.no_pesanan}')" class="text-accent1 p-1 hover:bg-accent1/10 rounded"><i data-lucide="printer"></i></button><button onclick="hapusData('pesanan', ${o.id})" class="text-red-400 p-1 hover:bg-red-50 rounded"><i data-lucide="trash-2"></i></button></td></tr>`;
    });
    document.getElementById('order-table-body').innerHTML = oH || '<tr><td colspan="3" class="p-4 text-center">Kosong</td></tr>';

    // Menambahkan tombol edit (pencil icon) pada tabel Pengeluaran
    let eH = ''; expenses.sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal)).forEach(e => {
        eH += `<tr><td class="p-4 font-bold">${e.tanggal}</td><td class="p-4 font-bold text-primary">${e.nama_item} (x${e.qty})</td><td class="p-4 font-black text-right">Rp ${e.total.toLocaleString('id-ID')}</td><td class="p-4 text-center flex justify-center gap-1"><button onclick="bukaEditPengeluaran(${e.id})" class="text-blue-500 p-1 hover:bg-blue-50 rounded"><i data-lucide="pencil"></i></button><button onclick="hapusData('pengeluaran', ${e.id})" class="text-red-400 p-1 hover:bg-red-50 rounded"><i data-lucide="trash-2"></i></button></td></tr>`;
    });
    document.getElementById('expense-table-body').innerHTML = eH || '<tr><td colspan="4" class="p-4 text-center">Kosong</td></tr>';
    
    lucide.createIcons(); renderCharts(orders, expenses);
}

function renderCharts(orders, expenses) {
    const ctxM = document.getElementById('menuChart').getContext('2d');
    const ctxP = document.getElementById('paymentChart').getContext('2d');
    if (menuChartInstance) menuChartInstance.destroy();
    if (paymentChartInstance) paymentChartInstance.destroy();
    
    let mD = { 'Puding Karamel': 0, 'Puding Karamel Regal': 0, 'Puding Karamel Oreo': 0, 'Puding Karamel 500ml': 0, 'Puding Regal 500ml': 0, 'Puding Oreo 500ml': 0 };
    let pD = { 'Tunai': 0, 'Transfer': 0, 'QRIS': 0 };
    orders.forEach(o => {
        if (o.detail_pesanan) o.detail_pesanan.forEach(i => { if (mD[i.name] !== undefined) mD[i.name] += i.qty; });
        pD[o.metode_pembayaran] += o.total_harga;
    });

    const opt = { responsive: true, maintainAspectRatio: false, cutout: '75%', layout: { padding: 30 }, plugins: { legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10, weight: 'bold' }, color: '#170C79' } } } };
    const colors = ['#170C79', '#56B6C6', '#8ACBD0', '#F59E0B', '#EF4444', '#10B981'];

    menuChartInstance = new Chart(ctxM, { type: 'doughnut', data: { labels: Object.keys(mD), datasets: [{ data: Object.values(mD), backgroundColor: colors, borderWidth: 0 }] }, options: opt });
    paymentChartInstance = new Chart(ctxP, { type: 'doughnut', data: { labels: Object.keys(pD), datasets: [{ data: Object.values(pD), backgroundColor: ['#EFE3CA', '#56B6C6', '#170C79'], borderWidth: 1, borderColor: '#d4cbb0' }] }, options: opt });
}

/** 7. FUNGSI EDIT DATA */
function closeEditModal(modalId) {
    document.getElementById(modalId).classList.add('hidden-force');
    document.getElementById(modalId).classList.remove('flex-force');
}

function bukaEditPesanan(id) {
    const o = globalOrders.find(x => x.id === id);
    if (!o) return;
    document.getElementById('edit-order-id').value = o.id;
    document.getElementById('edit-order-method').value = o.metode_pembayaran;
    document.getElementById('edit-order-total').value = o.total_harga;
    
    document.getElementById('edit-order-modal').classList.remove('hidden-force');
    document.getElementById('edit-order-modal').classList.add('flex-force');
}

async function simpanEditPesanan(e) {
    e.preventDefault();
    const id = document.getElementById('edit-order-id').value;
    const method = document.getElementById('edit-order-method').value;
    const total = parseInt(document.getElementById('edit-order-total').value);

    const { error } = await supabaseClient.from('pesanan').update({ total_harga: total, metode_pembayaran: method }).eq('id', id);
    if (error) showCustomAlert('Gagal', error.message, 'error');
    else {
        showCustomAlert('Berhasil', 'Pesanan diperbarui.');
        closeEditModal('edit-order-modal');
        generateReport();
    }
}

function bukaEditPengeluaran(id) {
    const e = globalExpenses.find(x => x.id === id);
    if (!e) return;
    document.getElementById('edit-expense-id').value = e.id;
    document.getElementById('edit-expense-date').value = e.tanggal;
    document.getElementById('edit-expense-name').value = e.nama_item;
    document.getElementById('edit-expense-qty').value = e.qty;
    document.getElementById('edit-expense-price').value = e.harga_satuan;
    document.getElementById('edit-expense-method').value = e.metode_pembayaran;
    
    document.getElementById('edit-expense-modal').classList.remove('hidden-force');
    document.getElementById('edit-expense-modal').classList.add('flex-force');
}

async function simpanEditPengeluaran(e) {
    e.preventDefault();
    const id = document.getElementById('edit-expense-id').value;
    const date = document.getElementById('edit-expense-date').value;
    const name = document.getElementById('edit-expense-name').value;
    const qty = parseInt(document.getElementById('edit-expense-qty').value);
    const price = parseInt(document.getElementById('edit-expense-price').value);
    const method = document.getElementById('edit-expense-method').value;
    const total = qty * price;

    const { error } = await supabaseClient.from('pengeluaran').update({ 
        tanggal: date, nama_item: name, qty: qty, harga_satuan: price, total: total, metode_pembayaran: method 
    }).eq('id', id);
    
    if (error) showCustomAlert('Gagal', error.message, 'error');
    else {
        showCustomAlert('Berhasil', 'Pengeluaran diperbarui.');
        closeEditModal('edit-expense-modal');
        generateReport();
    }
}

/** 8. EXPORT & MISC */
function exportToExcel() {
    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;
    const data = [ ["LAPORAN KEUANGAN PUDING"], ["Periode:", `${start} s/d ${end}`], [], ["RINGKASAN"], ["Total Pemasukan", document.getElementById('sum-income').innerText], ["Total Pengeluaran", document.getElementById('sum-expense').innerText], ["Saldo Bersih", document.getElementById('sum-balance').innerText], [], ["DETAIL PEMASUKAN"], ["Tanggal", "ID Pesanan", "Menu/Item", "Metode", "Total Harga"] ];
    globalOrders.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).forEach(o => { const detail = o.detail_pesanan ? o.detail_pesanan.map(i => `${i.qty}x ${i.name}`).join(', ') : ''; data.push([new Date(o.created_at).toLocaleDateString(), o.no_pesanan, detail, o.metode_pembayaran, o.total_harga]); });
    data.push([], ["DETAIL PENGELUARAN"], ["Tanggal", "Nama Item", "Qty", "Harga Satuan", "Total", "Metode"]);
    globalExpenses.forEach(e => { data.push([e.tanggal, e.nama_item, e.qty, e.harga_satuan, e.total, e.metode_pembayaran]); });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `Laporan_Puding_${start}.xlsx`);
    showCustomAlert('Berhasil', 'File Excel telah diunduh.');
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;

    doc.setFillColor(23, 12, 121); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.text("LAPORAN KEUANGAN PUDING", 14, 25);
    doc.setFontSize(10); doc.text(`Periode: ${start} s/d ${end}`, 14, 32);

    doc.autoTable({ startY: 45, head: [['RINGKASAN', 'NILAI']], body: [ ['Total Pemasukan', document.getElementById('sum-income').innerText], ['Total Pengeluaran', document.getElementById('sum-expense').innerText], ['Saldo Bersih', document.getElementById('sum-balance').innerText] ], theme: 'striped', headStyles: { fillColor: [86, 182, 198] } });

    doc.setTextColor(23, 12, 121);
    doc.setFontSize(14); doc.text("DETAIL PEMASUKAN", 14, doc.lastAutoTable.finalY + 15);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 20, head: [['Tanggal', 'ID', 'Item', 'Metode', 'Total']], body: globalOrders.map(o => [ new Date(o.created_at).toLocaleDateString(), o.no_pesanan, o.detail_pesanan.map(i => `${i.qty}x ${i.name}`).join('\n'), o.metode_pembayaran, `Rp ${o.total_harga.toLocaleString()}` ]), headStyles: { fillColor: [23, 12, 121] }, styles: { fontSize: 8 } });

    doc.setFontSize(14); doc.text("DETAIL PENGELUARAN", 14, doc.lastAutoTable.finalY + 15);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 20, head: [['Tanggal', 'Item', 'Qty', 'Total']], body: globalExpenses.map(e => [e.tanggal, e.nama_item, e.qty, `Rp ${e.total.toLocaleString()}`]), headStyles: { fillColor: [86, 182, 198] }, styles: { fontSize: 8 } });

    doc.save(`Laporan_Puding_${start}.pdf`);
    showCustomAlert('Berhasil', 'File PDF telah diunduh.');
}

function tampilkanStruk(no, date, items, total, method) {
    document.getElementById('receipt-date').innerText = date.toLocaleString('id-ID');
    document.getElementById('receipt-no').innerText = no;
    document.getElementById('receipt-method').innerText = method;
    document.getElementById('receipt-total-price').innerText = 'Rp ' + total.toLocaleString('id-ID');
    let h = ''; items.forEach(i => h += `<div class="flex justify-between"><span>${i.qty}x ${i.name}</span><span>${(i.subtotal).toLocaleString()}</span></div>`);
    document.getElementById('receipt-items').innerHTML = h;
    document.getElementById('receipt-modal').classList.remove('hidden');
}

function cetakStrukUlang(no) {
    const o = globalOrders.find(x => x.no_pesanan === no);
    if (o) tampilkanStruk(o.no_pesanan, new Date(o.created_at), o.detail_pesanan, o.total_harga, o.metode_pembayaran);
    lucide.createIcons();
}

function closeReceipt() { 
    document.getElementById('receipt-modal').classList.add('hidden'); 
    document.querySelectorAll('[id^="qty-"]').forEach(el => el.innerText = '0'); 
    document.getElementById('add-item-name').value = ''; document.getElementById('add-item-price').value = '0';
    calculateTotal(); 
}

function hapusData(tabel, id) {
    customConfirm(async () => {
        const { error } = await supabaseClient.from(tabel).delete().eq('id', id);
        if (error) showCustomAlert('Gagal', 'Izin ditolak.', 'error');
        else { showCustomAlert('Dihapus', 'Data bersih.'); generateReport(); }
    });
}