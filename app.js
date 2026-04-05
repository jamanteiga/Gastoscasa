'use strict';

const SB_URL = "https://sesnoctvegetxcgjihuh.supabase.co"; 
const SB_KEY = "09092016jampA!"; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
const FAMILIA_ID = "abegondo_pro_2024";

let transacciones = JSON.parse(localStorage.getItem('finanzas_data')) || [];
let ajustes = JSON.parse(localStorage.getItem('finanzas_ajustes')) || { pin: null, plantillas: [], presupuesto: 0 };
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

// Mejora Visual iPhone: Vibración sutil
function vibrate() {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(15);
    }
}

window.onload = async () => {
    if (ajustes.pin) {
        let pass = prompt("PIN DE ACCESO:");
        if (pass !== ajustes.pin) { document.body.innerHTML = "Acceso denegado"; return; }
    }
    // Cargar valores en Ajustes
    document.getElementById('adj-pin').value = ajustes.pin || '';
    document.getElementById('adj-presupuesto').value = ajustes.presupuesto || 0;

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
    vibrate(); // Vibrar al guardar
    localStorage.setItem('finanzas_data', JSON.stringify(transacciones));
    localStorage.setItem('finanzas_ajustes', JSON.stringify(ajustes));
    const { error } = await supabaseClient.from('finanzas_db').upsert({ usuario_id: FAMILIA_ID, datos: transacciones });
    document.getElementById('sync-status').style.background = error ? "#ff3b30" : "#34c759";
}

function actualizarUI() {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    const ing = transacciones.filter(t => t.tipo === 'ingreso').reduce((a,b) => a+b.monto, 0);
    const gas = transacciones.filter(t => t.tipo === 'gasto').reduce((a,b) => a+b.monto, 0);
    
    // Cálculo de gasto mes actual para presupuesto
    const gastoMes = transacciones
        .filter(t => t.tipo === 'gasto' && new Date(t.fecha).getMonth() === mesActual && new Date(t.fecha).getFullYear() === anioActual)
        .reduce((a,b) => a+b.monto, 0);

    document.getElementById('balanceDisplay').textContent = (ing - gas).toFixed(2) + "€";
    document.getElementById('totalIngresos').textContent = ing.toFixed(0);
    document.getElementById('totalGastos').textContent = gas.toFixed(0);

    // Lógica Barra Presupuesto
    if(ajustes.presupuesto > 0) {
        const porcentaje = Math.min((gastoMes / ajustes.presupuesto) * 100, 100);
        const bar = document.getElementById('presupuesto-bar');
        bar.style.width = porcentaje + "%";
        bar.style.background = porcentaje > 90 ? "#ff3b30" : (porcentaje > 70 ? "#ff9500" : "#34c759");
        document.getElementById('presupuesto-texto').textContent = `${gastoMes.toFixed(0)}€ / ${ajustes.presupuesto}€`;
        document.getElementById('presupuesto-container').style.display = 'block';
    } else {
        document.getElementById('presupuesto-container').style.display = 'none';
    }

    renderLista(transacciones.slice(-15).reverse(), 'listaRecientes');
}

// --- RESTO DE FUNCIONES (Siguen igual pero con Haptic) ---

async function guardarMovimiento() {
    const monto = parseFloat(document.getElementById('main-monto').value);
    if(!monto) return;
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
}

async function borrarTransaccion(id) {
    if (!confirm("¿Eliminar registro?")) return;
    vibrate();
    transacciones = transacciones.filter(t => t.id !== id);
    actualizarUI();
    await guardarNube();
}

function updateAjuste(k, v) {
    ajustes[k] = k === 'presupuesto' ? parseFloat(v) : v;
    localStorage.setItem('finanzas_ajustes', JSON.stringify(ajustes));
    vibrate();
    actualizarUI();
}

// --- Gestión Navegación y UI ---
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
    vibrate();
    const isAct = document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').style.display = isAct ? 'block' : 'none';
}

// ... Mantener renderSelects, updateSubs, filtrarLupa, exportarExcel del código anterior ...
// (Asegúrate de incluir las funciones de plantillas que ya hicimos)

function renderLista(lista, containerId) {
    document.getElementById(containerId).innerHTML = lista.map(t => `
        <div class="item" style="display:flex; justify-content:space-between; align-items:center;">
            <div><strong>${t.desc}</strong><br><small>${t.categoria}</small></div>
            <div style="text-align:right">
                <div class="${t.tipo === 'ingreso' ? 'text-ingreso' : 'text-gasto'}" style="font-weight:700">
                    ${t.tipo === 'ingreso' ? '+' : '-'}${t.monto.toFixed(2)}€
                </div>
                <button onclick="borrarTransaccion(${t.id})" style="border:none; background:none; color:red; font-size:10px; padding:5px;">BORRAR</button>
            </div>
        </div>
    `).join('');
}