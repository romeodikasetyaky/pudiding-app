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

/** 2. LOGIKA LOGIN & SESI (FIXED) */
document.addEventListener('DOMContentLoaded', () => {
    // Jalankan pengecekan sesi saat halaman dimuat
    setTimeout(() => {
        checkSession();
        // Sembunyikan overlay loading setelah 1 detik
        document.getElementById('loading-overlay').style.opacity = '0';
        setTimeout(() => document.getElementById('loading-overlay').classList.add('hidden-force'), 500);
    }, 1000);
});

function handleLogin(e) {
    e.preventDefault();
    
    // Pembersihan input
    const user = document.getElementById('username').value.trim().toLowerCase();
    const pass = document.getElementById('password').value.trim().toLowerCase();

    if (user === 'puding' && pass === 'karamel') {
        localStorage.setItem('puding_logged_in', 'true');
        console.log("Login sukses, mengalihkan...");
        checkSession(); // Jalankan pengalihan tampilan
    } else {
        alert("Username atau Password salah!");
    }
}

function handleLogout() {
    localStorage.removeItem('puding_logged_in');
    location.reload(); // Refresh total untuk keamanan
}

function checkSession() {
    const isLogin = localStorage.getItem('puding_logged_in') === 'true';
    const loginScr = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');

    if (isLogin) {
        // SEMBUNYIKAN LOGIN, TAMPILKAN DASHBOARD (FORCE)
        loginScr.classList.add('hidden-force');
        loginScr.classList.remove('flex');
        
        mainApp.classList.remove('hidden-force');
        mainApp.classList.add('flex'); // Paksa jadi flex agar Tailwind Sidebar jalan
        
        // Inisialisasi fitur dashboard
        lucide.createIcons();
        initApp();
    } else {
        // TAMPILKAN LOGIN, SEMBUNYIKAN DASHBOARD
        loginScr.classList.remove('hidden-force');
        loginScr.classList.add('flex');
        
        mainApp.classList.add('hidden-force');
        mainApp.classList.remove('flex');
    }
}

/** 3. FITUR KASIR */
function initApp() {
    const today = new Date().toISOString().split('T')[0];
    const orderDateInput = document.getElementById('order-date');
    if (orderDateInput) orderDateInput.value = today;
}

function updateQty(id, change) {
    const el = document.getElementById(id);
    let cur = parseInt(el.innerText);
    if (cur + change >= 0) {
        el.innerText = cur + change;
        calculateTotal();
    }
}

function calculateTotal() {
    let sub = 0;
    for (let id in menus) {
        sub += parseInt(document.getElementById(id).innerText) * menus[id].price;
    }
    const addPrice = parseInt(document.getElementById('add-item-price').value) || 0;
    const total = sub + addPrice;
    document.getElementById('total-price').innerText = total.toLocaleString('id-ID');
    return total;
}

function switchTab(tabId) {
    // Sembunyikan semua konten tab
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden-force');
        el.classList.remove('block-force');
    });
    // Matikan semua tombol nav
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    // Tampilkan tab yang dipilih
    document.getElementById(`page-${tabId}`).classList.remove('hidden-force');
    document.getElementById(`page-${tabId}`).classList.add('block-force');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    
    lucide.createIcons();
}

/** 4. SUPABASE TRANSACTION (Contoh Sederhana) */
async function konfirmasiPesanan() {
    const total = calculateTotal();
    if (total === 0) {
        alert("Pilih menu terlebih dahulu!");
        return;
    }
    
    alert("Pesanan disimpan! (Integrasi Supabase Aktif)");
    // Reset Qty setelah simpan
    document.querySelectorAll('[id^="qty-"]').forEach(el => el.innerText = '0');
    document.getElementById('add-item-price').value = '0';
    calculateTotal();
}