'use strict';

const SB_URL = "https://sesnoctvegetxcgjihuh.supabase.co"; 
const SB_KEY = "09092016jampA!"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const FAMILIA_ID = "abegondo_pro_2024";

let transacciones = JSON.parse(localStorage.getItem('finanzas_data')) || [];
let ajustes = JSON.parse(localStorage.getItem('finanzas_ajustes')) || { pin: null, plantillas: [], presupuesto: 0 };
let currentTipo = 'gasto';
let chartObj = null;

// CATEGORÍAS ORIGINALES RESTAURADAS
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

function vibrate() { if (window.navigator?.vibrate) window.navigator.vibrate(15); }

window.onload = async () => {
    if (ajustes.pin) {
        let pass = prompt("PIN DE ACCESO:");
        if (pass !== ajustes.pin) { document.body.innerHTML = "Acceso denegado"; return; }
    }
    document.getElementById('adj-pin').value = ajustes.pin || '';
    document.getElementById('adj-presupuesto').value = ajustes.presupuesto || 0;
    renderSelects();
    actualizarUI();
    await cargarNube();
};

// --- Sincronización Supabase ---
async function cargarNube() {
    try {
        const { data } = await supabaseClient.from('finanzas_db').select('datos').eq('usuario_id', FAMILIA_ID).maybeSingle();
        if (data?.datos) { 
            transacciones = data.datos; 
            actualizarUI(); 
            document.getElementById('sync-status').style.background = "#34c759"; 
        }
    } catch (e) { document.getElementById('sync-status').style.background = "#ff3b30"; }
}

async function guardarNube() {
    vibrate();
    localStorage.setItem('finanzas_data', JSON.stringify(transacciones));
    localStorage.setItem('finanzas_ajustes', JSON.stringify(ajustes));
    const { error } = await supabaseClient.from('finanzas_db').upsert({ usuario_id: FAMILIA_ID, datos: transacciones });
    document.getElementById('sync-status').style.background = error ? "#ff3b30" : "#34c759";
}

// --- Interfaz Principal ---
function actualizarUI() {
    const ahora = new Date();
    const ing = transacciones.filter(t => t.tipo === 'ingreso').reduce((a,b) => a+b.monto, 0);
    const gas = transacciones.filter(t => t.tipo === 'gasto').reduce((a,b) => a+b.monto, 0);
    const gastoMes = transacciones.filter(t => t.tipo === 'gasto' && new Date(t.fecha).getMonth() === ahora.getMonth()).reduce((a,b) => a+b.monto, 0);

    document.getElementById('balanceDisplay').textContent = (ing - gas).toFixed(2) + "€";
    document.getElementById('totalIngresos').textContent = ing.toFixed(0);
    document.getElementById('totalGastos').textContent = gas.toFixed(0);

    if(ajustes.presupuesto > 0) {
        const porc = Math.min((gastoMes / ajustes.presupuesto) * 100, 100);
        document.getElementById('presupuesto-bar').style.width = porc + "%";
        document.getElementById('presupuesto-texto').textContent = `${gastoMes.toFixed(0)}€ / ${ajustes.presupuesto}€`;
        document.getElementById('presupuesto-container').style.display = 'block';
    }
    renderLista(transacciones.slice(-15).reverse(), 'listaRecientes');
}

// --- Manejo de Categorías ---
function setTipo(t) {
    currentTipo = t;
    document.getElementById('tab-ing').classList.toggle('active', t === 'ingreso');
    document.getElementById('tab-gas').classList.toggle('active', t === 'gasto');
    document.getElementById('subcat-wrap').style.display = t === 'gasto' ? 'block' : 'none';
    renderSelects();
}

function renderSelects() {
    const mainCat = document.getElementById('main-cat');
    const defCat = document.getElementById('def-cat');
    const cats = currentTipo === 'ingreso' ? categorias.ingreso : Object.keys(categorias.gasto);
    
    mainCat.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    defCat.innerHTML = Object.keys(categorias.gasto).map(c => `<option value="${c}">${c}</option>`).join('');
    updateSubs(); updateSubsDef();
}

function updateSubs() {
    const cat = document.getElementById('main-cat').value;
    const subs = currentTipo === 'gasto' ? (categorias.gasto[cat] || []) : [];
    document.getElementById('main-sub').innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
}

function updateSubsDef() {
    const cat = document.getElementById('def-cat').value;
    const subs = categorias.gasto[cat] || [];
    document.getElementById('def-sub').innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
}

// --- Gráfico de Anillo con Efecto 3D ---
function filtrarGrafico(periodo) {
    const ahora = new Date();
    const filtrados = transacciones.filter(t => {
        const f = new Date(t.fecha);
        return periodo === 'semana' ? (ahora - f < 7*24*60*60*1000) : (f.getMonth() === ahora.getMonth());
    });

    const dataMap = {};
    filtrados.filter(t => t.tipo === 'gasto').forEach(t => {
        const c = t.categoria.split(' (')[0];
        dataMap[c] = (dataMap[c] || 0) + t.monto;
    });

    const ctx = document.getElementById('chartGastos').getContext('2d');
    if (chartObj) chartObj.destroy();
    
    chartObj = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataMap),
            datasets: [{
                data: Object.values(dataMap),
                backgroundColor: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#af52de'],
                borderWidth: 2,
                borderColor: '#ffffff',
                offset: 15, // Separación de las piezas para efecto 3D
                hoverOffset: 25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            }
        }
    });
    const total = Object.values(dataMap).reduce((a,b)=>a+b,0);
    document.getElementById('chart-total-text').textContent = total.toFixed(0) + "€";
}

// --- Acciones y Navegación ---
function showSection(id) {
    vibrate();
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('section-title').textContent = id.toUpperCase();
    if(id === 'graficos') filtrarGrafico('mes');
    if(id === 'definiciones') renderPlantillas();
    if(document.getElementById('sidebar').classList.contains('active')) toggleMenu();
}

function toggleMenu() {
    const isAct = document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').style.display = isAct ? 'block' : 'none';
}

async function guardarMovimiento() {
    const monto = parseFloat(document.getElementById('main-monto').value);
    if(!monto) return;
    transacciones.push({
        id: Date.now(), tipo: currentTipo, monto,
        desc: document.getElementById('main-desc').value || document.getElementById('main-cat').value,
        categoria: currentTipo === 'gasto' ? `${document.getElementById('main-cat').value} (${document.getElementById('main-sub').value})` : document.getElementById('main-cat').value,
        fecha: new Date().toISOString()
    });
    actualizarUI(); await guardarNube(); showSection('inicio');
    document.getElementById('main-monto').value = '';
}

function renderLista(lista, id) {
    document.getElementById(id).innerHTML = lista.map(t => `
        <div class="item">
            <div><strong>${t.desc}</strong><br><small>${t.categoria}</small></div>
            <div style="text-align:right">
                <div class="${t.tipo==='ingreso'?'text-ingreso':'text-gasto'}">${t.monto.toFixed(2)}€</div>
                <button onclick="borrarTransaccion(${t.id})" style="border:none; background:none; color:red; font-size:10px;">BORRAR</button>
            </div>
        </div>
    `).join('');
}

async function borrarTransaccion(id) {
    if(confirm("¿Eliminar registro?")) {
        transacciones = transacciones.filter(t => t.id !== id);
        actualizarUI(); await guardarNube();
    }
}

function updateAjuste(k, v) { 
    ajustes[k] = (k === 'presupuesto') ? parseFloat(v) : v; 
    guardarNube(); 
    actualizarUI(); 
}

function guardarPlantilla() {
    const nombre = document.getElementById('def-nombre').value;
    if(!nombre) return;
    ajustes.plantillas.push({
        nombre, 
        cat: document.getElementById('def-cat').value, 
        sub: document.getElementById('def-sub').value
    });
    guardarNube(); renderPlantillas();
    document.getElementById('def-nombre').value = '';
}

function renderPlantillas() {
    document.getElementById('listaPlantillas').innerHTML = ajustes.plantillas.map((p, i) => `
        <div class="item" onclick="usarPlantilla(${i})">
            <div><strong>${p.nombre}</strong><br><small>${p.cat} > ${p.sub}</small></div>
            <button onclick="event.stopPropagation(); ajustes.plantillas.splice(${i},1); guardarNube(); renderPlantillas();" style="color:red; border:none; background:none;">X</button>
        </div>
    `).join('');
}

function usarPlantilla(i) {
    const p = ajustes.plantillas[i];
    setTipo('gasto');
    document.getElementById('main-desc').value = p.nombre;
    document.getElementById('main-cat').value = p.cat;
    updateSubs();
    document.getElementById('main-sub').value = p.sub;
    showSection('cuentas');
}

function exportarExcelPro() {
    const ws = XLSX.utils.json_to_sheet(transacciones);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Finanzas");
    XLSX.writeFile(wb, "Gastos_Casa.xlsx");
}