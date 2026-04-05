'use strict';

const SB_URL = "https://sesnoctvegetxcgjihuh.supabase.co"; 
const SB_KEY = "09092016jampA!"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const FAMILIA_ID = "abegondo_pro_2024"; // ID interno de base de datos (no visible en UI)

let transacciones = JSON.parse(localStorage.getItem('finanzas_data')) || [];
let ajustes = JSON.parse(localStorage.getItem('finanzas_ajustes')) || { compacta: false, pin: null };
let currentTipo = 'gasto';
let chartObj = null;

const categorias = {
    ingreso: ['Salario', 'Regalo', 'Interés', 'Otros'],
    gasto: {
        'Alimentación': ['Mercadona', 'Xelo', 'Alcampo', 'Eroski', 'Carrefour', 'Otros'],
        'Café': ['Gala', 'Dacunha', 'Otros'],
        'Hogar': ['Electricidad', 'Internet', 'Amazon', 'Apple', 'Mantenimiento hogar'],
        'Coche': ['Combustible', 'Autopista', 'Seguro Coche 1', 'Seguro Coche 2', 'Taller'],
        'Salud': ['Farmacia', 'Médico', 'Notaría', 'Abogacía'],
        'Ocio': ['Cenas', 'Comidas', 'Meriendas', 'Netflix', 'Spotify', 'HBO'],
        'Otros': ['Regalos', 'Familia', 'Rutina', 'Transporte', 'Tarjetas']
    }
};

window.onload = async () => {
    if (ajustes.pin) {
        let pass = prompt("PIN DE ACCESO:");
        if (pass !== ajustes.pin) { document.body.innerHTML = "Acceso denegado"; return; }
    }
    renderSelects();
    actualizarUI();
    await cargarNube();
};

async function cargarNube() {
    try {
        const { data } = await supabaseClient.from('finanzas_db').select('datos').eq('usuario_id', FAMILIA_ID).maybeSingle();
        if (data && data.datos) {
            transacciones = data.datos;
            actualizarUI();
            document.getElementById('sync-status').style.background = "#34c759";
        }
    } catch (e) { document.getElementById('sync-status').style.background = "#ff3b30"; }
}

async function guardarNube() {
    localStorage.setItem('finanzas_data', JSON.stringify(transacciones));
    const { error } = await supabaseClient.from('finanzas_db').upsert({ usuario_id: FAMILIA_ID, datos: transacciones });
    document.getElementById('sync-status').style.background = error ? "#ff3b30" : "#34c759";
}

async function escanearTicket(input) {
    if (!input.files || !input.files[0]) return;
    
    const btnSave = document.getElementById('btn-save-main');
    const originalText = btnSave.textContent;
    btnSave.textContent = "Leyendo ticket... ⏳";
    btnSave.style.background = "#ff9500";

    try {
        const { data: { text } } = await Tesseract.recognize(input.files[0], 'eng');
        const regexMoneda = /(\d+[\.,]\d{2})/g;
        const coincidencias = text.match(regexMoneda);

        if (coincidencias) {
            const valores = coincidencias.map(v => parseFloat(v.replace(',', '.')));
            const maximo = Math.max(...valores);
            document.getElementById('main-monto').value = maximo.toFixed(2);
        } else {
            alert("No se detectó el importe. Intenta con una foto más clara.");
        }
    } catch (e) {
        alert("Error al procesar imagen");
    } finally {
        btnSave.textContent = originalText;
        btnSave.style.background = "#007aff";
    }
}

function toggleMenu() {
    const isAct = document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').style.display = isAct ? 'block' : 'none';
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('section-title').textContent = id === 'inicio' ? 'GASTOS CASA' : id.toUpperCase();
    if(id === 'graficos') initChart();
    if(document.getElementById('sidebar').classList.contains('active')) toggleMenu();
}

function setTipo(t) {
    currentTipo = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(t === 'ingreso' ? 'tab-ing' : 'tab-gas').classList.add('active');
    renderSelects();
}

function renderSelects() {
    const selMain = document.getElementById('main-cat');
    const list = (currentTipo === 'ingreso') ? categorias.ingreso : Object.keys(categorias.gasto);
    selMain.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
    updateSubs();
}

function updateSubs() {
    const mainVal = document.getElementById('main-cat').value;
    const wrap = document.getElementById('subcat-wrap');
    const selSub = document.getElementById('main-sub');
    if(currentTipo === 'gasto' && categorias.gasto[mainVal]) {
        wrap.style.display = 'block';
        selSub.innerHTML = categorias.gasto[mainVal].map(s => `<option value="${s}">${s}</option>`).join('');
    } else { wrap.style.display = 'none'; }
}

async function guardarMovimiento() {
    const monto = parseFloat(document.getElementById('main-monto').value);
    if(!monto) return alert("Indica el importe");
    
    const item = {
        id: Date.now(),
        tipo: currentTipo,
        monto,
        desc: document.getElementById('main-desc').value || document.getElementById('main-cat').value,
        categoria: currentTipo === 'gasto' ? `${document.getElementById('main-cat').value} (${document.getElementById('main-sub').value})` : document.getElementById('main-cat').value,
        fecha: new Date().toISOString()
    };
    
    transacciones.push(item);
    actualizarUI();
    await guardarNube();
    showSection('inicio');
    document.getElementById('main-monto').value = '';
    document.getElementById('main-desc').value = '';
}

function actualizarUI() {
    const ing = transacciones.filter(t => t.tipo === 'ingreso').reduce((a,b) => a+b.monto, 0);
    const gas = transacciones.filter(t => t.tipo === 'gasto').reduce((a,b) => a+b.monto, 0);
    document.getElementById('balanceDisplay').textContent = (ing - gas).toFixed(2) + "€";
    document.getElementById('totalIngresos').textContent = ing.toFixed(0);
    document.getElementById('totalGastos').textContent = gas.toFixed(0);
    
    renderLista(transacciones.slice(-15).reverse(), 'listaRecientes');
}

function renderLista(lista, containerId) {
    document.getElementById(containerId).innerHTML = lista.map(t => `
        <div class="item">
            <div><strong>${t.desc}</strong><br><small>${t.categoria}</small></div>
            <div class="${t.tipo === 'ingreso' ? 'text-ingreso' : 'text-gasto'}" style="font-weight:700">
                ${t.tipo === 'ingreso' ? '+' : '-'}${t.monto.toFixed(2)}€
            </div>
        </div>
    `).join('');
}

function filtrarLupa(val) {
    const q = val.toLowerCase();
    const filtrados = transacciones.filter(t => 
        t.desc.toLowerCase().includes(q) || t.categoria.toLowerCase().includes(q)
    );
    renderLista(filtrados.reverse(), 'res-busqueda');
}

function initChart() {
    const ctx = document.getElementById('chartGastos').getContext('2d');
    const stats = {};
    transacciones.filter(t => t.tipo === 'gasto').forEach(t => {
        const c = t.categoria.split(' (')[0];
        stats[c] = (stats[c] || 0) + t.monto;
    });
    if(chartObj) chartObj.destroy();
    chartObj = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(stats),
            datasets: [{ data: Object.values(stats), backgroundColor: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'], borderWidth: 0 }]
        },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
    const total = Object.values(stats).reduce((a,b) => a+b, 0);
    document.getElementById('chart-total-text').textContent = total.toFixed(2) + "€";
}

function updateAjuste(k, v) {
    ajustes[k] = v;
    localStorage.setItem('finanzas_ajustes', JSON.stringify(ajustes));
}

function exportarExcelPro() {
    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const mins = String(ahora.getMinutes()).padStart(2, '0');
    const segs = String(ahora.getSeconds()).padStart(2, '0');
    
    const nombreFichero = `${dia}/${mes}/${anio}-${horas}:${mins}:${segs}.xlsx`;

    const ws = XLSX.utils.json_to_sheet(transacciones);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    XLSX.writeFile(wb, nombreFichero);
}