'use strict';

// 1. Configuración por defecto (Ajustes)
let ajustes = JSON.parse(localStorage.getItem('ajustes_finanzas')) || {
    mostrarTotalDefecto: true,
    periodoDefecto: 'semana',
    diaInicioSemana: 1, // Lunes
    separadorDecimal: ',',
    redondear: false,
    vistaCompacta: false,
    centrarseIngresos: false,
    divisa: '€',
    pin: null
};

// 2. Función de Búsqueda (La Lupa)
function realizarBusqueda(termino) {
    const query = termino.toLowerCase();
    const resultados = transacciones.filter(t => 
        t.desc.toLowerCase().includes(query) || 
        t.categoria.toLowerCase().includes(query) ||
        t.monto.toString().includes(query)
    );
    renderLista(resultados, 'listaBusqueda');
}

// 3. Resumen General (Agrupado por grandes bloques)
function obtenerResumenGeneral() {
    const bloques = {
        Tarjetas: 0,
        Alimentación: 0,
        Suministros: ['Electricidad', 'Comunicación', 'Internet'],
        Ocio: 0
    };

    transacciones.forEach(t => {
        const cat = t.categoria;
        if (cat.includes('Alimentación')) bloques.Alimentación += t.monto;
        else if (cat.includes('Tarjetas')) bloques.Tarjetas += t.monto;
        else if (bloques.Suministros.some(s => cat.includes(s))) {
            // Lógica para sumar a Suministros
        }
    });
    return bloques;
}

// 4. Lógica de PIN de 4 dígitos
function verificarPin() {
    if (ajustes.pin) {
        const intento = prompt("Introduce tu PIN de 4 dígitos:");
        if (intento !== ajustes.pin) {
            alert("PIN Incorrecto");
            document.body.style.display = 'none';
        }
    }
}

// 5. Función de Exportación XLSX (SheetJS)
function exportarExcelPro() {
    const data = transacciones.map(t => ({
        Fecha: t.fecha,
        Tipo: t.tipo,
        Concepto: t.desc,
        Categoria: t.categoria,
        Importe: ajustes.redondear ? Math.round(t.monto) : t.monto,
        Moneda: ajustes.divisa
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Balance_Completo");
    XLSX.writeFile(wb, `Finanzas_Export_${new Date().toLocaleDateString()}.xlsx`);
}