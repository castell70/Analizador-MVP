import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';
import html2canvas from 'https://esm.sh/html2canvas@1.4.1';

// Defensive shim: catch and suppress DataCloneError from postMessage (e.g., PerformanceServerTiming)
(function(){
    const origPostMessage = window.postMessage.bind(window);
    window.postMessage = function(message, targetOrigin, transfer) {
        try {
            return origPostMessage(message, targetOrigin, transfer);
        } catch (err) {
            if (err && err.name === 'DataCloneError') {
                console.warn('Suppressed DataCloneError in postMessage:', err);
                return;
            }
            throw err;
        }
    };
})();

// NEW: Global event handlers to suppress DataCloneError bubbling as uncaught exceptions
window.addEventListener('error', (ev) => {
    try {
        // ev.message may contain DataCloneError text in some browsers; ev.error may have name
        if ((ev.error && ev.error.name === 'DataCloneError') || (typeof ev.message === 'string' && ev.message.includes('DataCloneError'))) {
            // Prevent the error from being logged as uncaught
            ev.preventDefault();
            console.warn('Suppressed uncaught DataCloneError:', ev.error || ev.message);
        }
    } catch (e) {
        // no-op
    }
});

// Also suppress promise rejections that may surface a DataCloneError
window.addEventListener('unhandledrejection', (ev) => {
    try {
        const reason = ev.reason;
        if ((reason && reason.name === 'DataCloneError') || (typeof reason === 'string' && reason.includes('DataCloneError'))) {
            ev.preventDefault();
            console.warn('Suppressed unhandledrejection DataCloneError:', reason);
        }
    } catch (e) {
        // no-op
    }
});

// Data Storage
const appData = {
    product: {},
    market: {},
    features: {},
    timeline: {},
};

// Navigation
function navigateTo(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(section).classList.add('active');
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
}

// Save Section Data
function saveSection(section) {
    const form = document.getElementById(`${section}Form`);
    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        data[input.id] = input.value;
    });

    appData[section] = data;
    updateProgress();
    showMessage('Sección guardada correctamente', 'success');
}

// Update Progress
function updateProgress() {
    const sections = ['product', 'market', 'features', 'timeline'];
    let completed = 0;

    sections.forEach(section => {
        if (Object.keys(appData[section]).length > 0) {
            completed++;
        }
    });

    const progress = Math.round((completed / 4) * 100);
    document.getElementById('stat-progress').textContent = progress + '%';
    document.getElementById('stat-sections').textContent = `${completed}/4`;
}

// Help Modal
function toggleHelp() {
    const modal = document.getElementById('helpModal');
    modal.classList.toggle('active');
}

// Generate Report
function generateReport() {
    const reportContent = document.getElementById('reportPreview');
    const content = document.querySelector('.report-content');

    if (!content) {
        const newContent = document.createElement('div');
        newContent.className = 'report-content visible';
        newContent.innerHTML = buildReportHTML();
        reportContent.innerHTML = '';
        reportContent.appendChild(newContent);
    }

    return reportContent.innerHTML;
}

function buildReportHTML() {
    const p = appData.product;
    const m = appData.market;
    const f = appData.features;
    const t = appData.timeline;

    const mainFeatures = f.mainFeatures ? f.mainFeatures.split('\n').filter(x => x.trim()) : [];
    const secondaryFeatures = f.secondaryFeatures ? f.secondaryFeatures.split('\n').filter(x => x.trim()) : [];
    const futureFeatures = f.futureFeatures ? f.futureFeatures.split('\n').filter(x => x.trim()) : [];
    const milestones = t.milestones ? t.milestones.split('\n').filter(x => x.trim()) : [];

    return `
        <div class="report-section">
            <h3>📋 Resumen Ejecutivo</h3>
            <p><strong>Producto:</strong> ${p.productName || 'N/A'}</p>
            <p><strong>Objetivo MVP:</strong> ${p.productObjective || 'N/A'}</p>
            <p><strong>Mercado Objetivo:</strong> ${m.targetMarket || 'N/A'}</p>
            <p><strong>Duración Estimada:</strong> ${t.duration || 'N/A'} semanas</p>
        </div>

        <div class="report-section">
            <h3>📦 Descripción del Producto</h3>
            <p>${p.productDesc || 'N/A'}</p>
            <p><strong>Propuesta de Valor:</strong> ${p.productValue || 'N/A'}</p>
        </div>

        <div class="report-section">
            <h3>📊 Análisis de Mercado</h3>
            <p><strong>Tamaño del Mercado:</strong> ${m.marketSize || 'N/A'}</p>
            <p><strong>Competencia:</strong> ${m.competition || 'N/A'}</p>
            <p><strong>Ventaja Competitiva:</strong> ${m.advantage || 'N/A'}</p>
        </div>

        <div class="report-section">
            <h3>⚙️ Características del MVP</h3>
            <p><strong>Características Principales:</strong></p>
            <ul>${mainFeatures.map(f => `<li>${f}</li>`).join('')}</ul>
            ${secondaryFeatures.length > 0 ? `
                <p style="margin-top: 12px;"><strong>Características Secundarias:</strong></p>
                <ul>${secondaryFeatures.map(f => `<li>${f}</li>`).join('')}</ul>
            ` : ''}
            ${futureFeatures.length > 0 ? `
                <p style="margin-top: 12px;"><strong>Características Futuras:</strong></p>
                <ul>${futureFeatures.map(f => `<li>${f}</li>`).join('')}</ul>
            ` : ''}
        </div>

        <div class="report-section">
            <h3>📅 Cronograma y Recursos</h3>
            <p><strong>Duración:</strong> ${t.duration || 'N/A'} semanas</p>
            <p><strong>Equipo:</strong> ${t.team || 'N/A'}</p>
            <p><strong>Presupuesto Estimado:</strong> $${t.budget || 'N/A'}</p>
            ${milestones.length > 0 ? `
                <p><strong>Hitos Principales:</strong></p>
                <ul>${milestones.map(m => `<li>${m}</li>`).join('')}</ul>
            ` : ''}
        </div>

        <div class="report-section">
            <h3>🚀 Pasos para Ejecutar el MVP</h3>
            <ol style="list-style: decimal; padding-left: 20px;">
                <li><strong>Validación Inicial:</strong> Confirma el problema con usuarios reales</li>
                <li><strong>Diseño:</strong> Crea mockups y prototipo de la interfaz</li>
                <li><strong>Desarrollo:</strong> Implementa las características principales</li>
                <li><strong>Testing:</strong> Realiza pruebas internas y con usuarios beta</li>
                <li><strong>Lanzamiento:</strong> Publica el MVP a usuarios iniciales</li>
                <li><strong>Feedback:</strong> Recopila datos e iteraciones continuas</li>
                <li><strong>Análisis:</strong> Mide KPIs y valida supuestos</li>
                <li><strong>Iteración:</strong> Ajusta según feedback de usuarios</li>
            </ol>
        </div>

        <div class="report-section">
            <h3>📈 Métricas de Éxito</h3>
            <ul>
                <li>Tasa de adopción inicial</li>
                <li>Retención de usuarios</li>
                <li>Satisfacción del cliente (NPS)</li>
                <li>Tiempo de implementación vs. planeado</li>
                <li>Validación de supuestos clave</li>
            </ul>
        </div>

        <div class="report-section">
            <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; color: #666; font-size: 13px;">
                Generado por MVP Analyzer - Powered by ITCPO<br>
                ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
        </div>
    `;
}

// Generate PDF
async function generatePDF() {
    const sections = ['product', 'market', 'features', 'timeline'];
    const allComplete = sections.every(s => Object.keys(appData[s]).length > 0);

    if (!allComplete) {
        showMessage('Por favor completa todas las secciones antes de generar el PDF', 'error');
        return;
    }

    const reportContent = document.getElementById('reportPreview');
    const currentHTML = reportContent.innerHTML;
    reportContent.innerHTML = buildReportHTML();

    try {
        const canvas = await html2canvas(reportContent, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgHeight = 297;
        const imgWidth = 210;
        const height = (canvas.height * imgWidth) / canvas.width;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, height);

        const productName = appData.product.productName || 'MVP_Report';
        pdf.save(`${productName}_MVP_Plan.pdf`);
        showMessage('PDF generado y descargado', 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showMessage('Error al generar el PDF', 'error');
    }

    reportContent.innerHTML = currentHTML;
}

// Print Report
function printReport() {
    const sections = ['product', 'market', 'features', 'timeline'];
    const allComplete = sections.every(s => Object.keys(appData[s]).length > 0);

    if (!allComplete) {
        showMessage('Por favor completa todas las secciones antes de imprimir', 'error');
        return;
    }

    const printWindow = window.open('', '', 'width=900,height=700');
    const reportContent = buildReportHTML();

    printWindow.document.write(`
        <html>
        <head>
            <title>MVP Report</title>
            <style>
                body { font-family: 'Noto Sans', sans-serif; padding: 20px; }
                h3 { color: #ff9500; margin-top: 20px; }
                ul { list-style-position: inside; }
                li { margin-bottom: 6px; }
            </style>
        </head>
        <body>
            ${reportContent}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
    showMessage('Ventana de impresión abierta', 'info', 3000);
}

// Load Demo Data
function loadDemoData() {
    appData.product = {
        productName: 'TaskFlow',
        productDesc: 'Aplicación web para gestionar tareas y proyectos en equipo con interfaz intuitiva y sincronización en tiempo real.',
        productValue: 'Interfaz más simple que Asana, 50% más económico que Monday.com, especializado en equipos PYME',
        productObjective: 'Validar que equipos de 5-20 personas adopten una herramienta de gestión de tareas'
    };

    appData.market = {
        targetMarket: 'Empresas PYME (5-50 empleados) en América Latina enfocadas en tech y servicios',
        marketSize: '25,000 potenciales usuarios en región',
        competition: 'Asana, Monday.com, Notion, Jira. Nuestros competidores principales son Asana (costoso) y Notion (no especializado)',
        advantage: 'Curva de aprendizaje 70% menor, interfaz minimalista, precio 60% menor que soluciones premium'
    };

    appData.features = {
        mainFeatures: 'Dashboard con vista de tareas\nCreación y asignación de tareas\nTableros Kanban\nSeguimiento de progreso\nNotificaciones en tiempo real',
        secondaryFeatures: 'Comentarios en tareas\nArchivos adjuntos\nFiltros y búsqueda\nExportación de reportes',
        futureFeatures: 'Integración con Slack\nAutomatización de flujos\nAnalytics avanzado\nMóvil nativa'
    };

    appData.timeline = {
        duration: '12',
        team: '1 Backend Developer, 1 Frontend Developer, 1 Designer UI/UX, 1 Product Manager',
        budget: '45000',
        milestones: 'Semana 2: Diseño finalizado\nSemana 5: MVP funcional\nSemana 8: Testing beta\nSemana 12: Lanzamiento inicial'
    };

    // Fill form fields
    fillFormFields('product');
    fillFormFields('market');
    fillFormFields('features');
    fillFormFields('timeline');

    updateProgress();
    showMessage('Datos de demostración cargados correctamente', 'success');
    navigateTo('dashboard');
}

function clearData() {
    // Reset stored data
    appData.product = {};
    appData.market = {};
    appData.features = {};
    appData.timeline = {};

    // Clear form fields
    ['product','market','features','timeline'].forEach(section => {
        const form = document.getElementById(`${section}Form`);
        if (!form) return;
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(input => input.value = '');
    });

    // Reset report preview to placeholder
    const reportPreview = document.getElementById('reportPreview');
    if (reportPreview) {
        reportPreview.innerHTML = '<p class="placeholder">Completa todas las secciones para generar el informe</p>';
    }

    updateProgress();
    showMessage('Datos limpiados correctamente', 'success');
}

function fillFormFields(section) {
    const form = document.getElementById(`${section}Form`);
    if (!form) return;

    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        if (appData[section][input.id]) {
            input.value = appData[section][input.id];
        }
    });
}

// Message box helper
let messageTimer = null;
function showMessage(text, type = 'info', duration = 4000) {
    const box = document.getElementById('messageBox');
    if (!box) {
        console.warn('Message box not found:', text);
        return;
    }

    box.className = `message-box show ${type}`;
    box.innerHTML = `<div class="msg-text">${text}</div><button class="close-msg" aria-label="Cerrar mensaje">&times;</button>`;

    const closeBtn = box.querySelector('.close-msg');
    closeBtn.addEventListener('click', () => hideMessage());

    if (messageTimer) clearTimeout(messageTimer);
    if (duration > 0) {
        messageTimer = setTimeout(() => hideMessage(), duration);
    }
}

function hideMessage() {
    const box = document.getElementById('messageBox');
    if (!box) return;
    box.classList.remove('show');
    box.classList.remove('info','success','error');
    box.innerHTML = '';
    if (messageTimer) {
        clearTimeout(messageTimer);
        messageTimer = null;
    }
}

// Expose functions to global scope
window.navigateTo = navigateTo;
window.saveSection = saveSection;
window.toggleHelp = toggleHelp;
window.generateReport = generateReport;
window.generatePDF = generatePDF;
window.printReport = printReport;
window.loadDemoData = loadDemoData;
window.clearData = clearData;
window.showMessage = showMessage;
window.hideMessage = hideMessage;

// Expose AI-related functions to global scope (for inline onclick handlers)
window.generateAIReport = generateAIReport;
window.downloadAIReportPDF = downloadAIReportPDF;
window.downloadAIReportWord = downloadAIReportWord;

// New: AI report generation (local agent simulation)
function simulateAIAgent(data) {
    // Basic synthesis using available fields - emulate analysis and suggestions
    const p = data.product || {};
    const m = data.market || {};
    const f = data.features || {};
    const t = data.timeline || {};

    const mainFeatures = f.mainFeatures ? f.mainFeatures.split('\n').filter(x => x.trim()) : [];
    const secondaryFeatures = f.secondaryFeatures ? f.secondaryFeatures.split('\n').filter(x => x.trim()) : [];
    const futureFeatures = f.futureFeatures ? f.futureFeatures.split('\n').filter(x => x.trim()) : [];
    const milestones = t.milestones ? t.milestones.split('\n').filter(x => x.trim()) : [];

    // Create analyst-style narrative
    const executive = `El MVP propuesto (${p.productName || 'Sin nombre'}) busca validar: ${p.productObjective || 'objetivo no especificado'}. Se recomienda priorizar un conjunto mínimo de funciones que permitan medir adopción y retención.`;
    const desc = `${p.productDesc || 'Descripción no disponible.'} Propuesta de valor: ${p.productValue || 'No especificada.'}`;
    const marketAnalysis = `Mercado objetivo: ${m.targetMarket || 'No especificado'}. Tamaño estimado: ${m.marketSize || 'N/A'}. Competencia principal: ${m.competition || 'N/A'}. Ventaja competitiva: ${m.advantage || 'N/A'}. Recomendación: focalizar en segmentos con menor penetración de soluciones costosas y mayor sensibilidad al precio.`;
    const featuresText = `Características principales sugeridas: ${mainFeatures.length ? mainFeatures.join('; ') : 'No se listaron características principales.'}` +
        (secondaryFeatures.length ? ` Características secundarias: ${secondaryFeatures.join('; ')}.` : '') +
        (futureFeatures.length ? ` Futuras: ${futureFeatures.join('; ')}.` : '');
    const schedule = `Propuesta de cronograma: Duración total estimada ${t.duration ? t.duration + ' semanas' : 'no especificada'}. Equipo sugerido: ${t.team || 'no especificado'}. Presupuesto estimado: ${t.budget ? '$' + t.budget : 'no especificado'}. Hitos clave: ${milestones.length ? milestones.join('; ') : 'Definir hitos principales'}. Recomendación: dividir en sprints de 2 semanas y priorizar entrega de una ruta crítica (autenticación, creación de tareas, vista principal).`;
    const steps = `Pasos recomendados: 1) Validación con 10-20 usuarios; 2) Prototipado; 3) Desarrollo de las características núcleo; 4) Pruebas beta; 5) Lanzamiento limitado; 6) Medición y ajustes.`;
    const metrics = `Métricas de éxito propuestas: tasa de adopción inicial, retención 7/30 días, NPS, tiempo medio hasta primer valor (TTFV), conversión a usuarios pagos (si aplica).`;

    // Combine into HTML
    const html = `
        <div class="report-section">
            <h3>Resumen Ejecutivo</h3>
            <p>${executive}</p>
        </div>
        <div class="report-section">
            <h3>Descripción del producto</h3>
            <p>${desc}</p>
        </div>
        <div class="report-section">
            <h3>Análisis de Mercado</h3>
            <p>${marketAnalysis}</p>
        </div>
        <div class="report-section">
            <h3>Características del MVP</h3>
            <p>${featuresText}</p>
        </div>
        <div class="report-section">
            <h3>Cronograma de Recursos Propuesto</h3>
            <p>${schedule}</p>
        </div>
        <div class="report-section">
            <h3>Pasos para ejecutar el MVP</h3>
            <p>${steps}</p>
        </div>
        <div class="report-section">
            <h3>Métricas de Éxito</h3>
            <p>${metrics}</p>
        </div>
        <div class="report-section">
            <p style="margin-top: 16px; font-size:13px; color:#666;">Generado por el Agente IA local de MVP Analyzer - ${new Date().toLocaleDateString('es-ES')}</p>
        </div>
    `;
    return html;
}

function generateAIReport() {
    // Validate at least one section exists
    const hasAny = ['product','market','features','timeline'].some(s => Object.keys(appData[s]).length > 0);
    if (!hasAny) {
        showMessage('Carga datos o usa "Cargar Demostración" antes de generar el Informe IA', 'error');
        return;
    }

    const iaPreview = document.getElementById('iaReportPreview');
    iaPreview.innerHTML = '<p class="placeholder">Generando informe IA...</p>';

    // Simulate processing delay
    setTimeout(() => {
        const aiHtml = simulateAIAgent(appData);
        iaPreview.innerHTML = `<div class="report-content visible">${aiHtml}</div>`;
        showMessage('Informe IA generado', 'success');
        navigateTo('ia-report');
    }, 700);
}

async function downloadAIReportPDF() {
    const iaPreview = document.getElementById('iaReportPreview');
    const content = iaPreview.querySelector('.report-content');
    if (!content) {
        showMessage('Genera el Informe IA antes de descargar', 'error');
        return;
    }

    try {
        const canvas = await html2canvas(content, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const height = (canvas.height * imgWidth) / canvas.width;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, height);
        const fileName = (appData.product.productName || 'IA_Report') + '_IA_Report.pdf';
        pdf.save(fileName);
        showMessage('PDF del Informe IA descargado', 'success');
    } catch (err) {
        console.error(err);
        showMessage('Error al generar PDF del Informe IA', 'error');
    }
}

function downloadAIReportWord() {
    const iaPreview = document.getElementById('iaReportPreview');
    const content = iaPreview.querySelector('.report-content');
    if (!content) {
        showMessage('Genera el Informe IA antes de descargar', 'error');
        return;
    }

    // Create HTML document and trigger download as .doc (widely supported by Word)
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><title>Informe IA</title></head><body>`;
    const footer = `</body></html>`;
    const html = header + content.innerHTML + footer;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const fileName = (appData.product.productName || 'IA_Report') + '_IA_Report.doc';
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);

    showMessage('Documento Word descargado', 'success');
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.section);
        });
    });

    const reportBtn = document.querySelector('[data-section="report"]');
    if (reportBtn) {
        reportBtn.addEventListener('click', generateReport);
    }

    // Keep previous click binding
    const iaBtn = document.querySelector('[data-section="ia-report"]');
    if (iaBtn) {
        iaBtn.addEventListener('click', () => {
            // when navigating to IA report show current preview or placeholder
            const iaPreview = document.getElementById('iaReportPreview');
            if (iaPreview && iaPreview.querySelector('.report-content')) {
                // nothing
            }
            navigateTo('ia-report');
        });
    }

    document.getElementById('helpModal').addEventListener('click', (e) => {
        if (e.target.id === 'helpModal') {
            toggleHelp();
        }
    });
});