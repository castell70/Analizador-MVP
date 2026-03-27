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

 // Generate a short value proposition based on product fields (improved)
function generateValueProposal() {
    const nameEl = document.getElementById('productName');
    const descEl = document.getElementById('productDesc');
    const objEl = document.getElementById('productObjective');
    const marketEl = document.getElementById('targetMarket'); // may be undefined on product section, but useful when available
    const valueEl = document.getElementById('productValue');
    if (!descEl || !valueEl) return;

    const name = (nameEl && nameEl.value || '').trim();
    const desc = (descEl.value || '').trim();
    const objective = (objEl && objEl.value || '').trim();
    const market = (marketEl && marketEl.value || '').trim();

    if (!desc && !objective && !name) {
        showMessage('Proporciona al menos Nombre, Descripción u Objetivo para generar la propuesta', 'error');
        return;
    }

    // Normalize and remove common stopwords to get meaningful keywords
    const stopwords = new Set([
        'que','con','para','por','como','entre','sobre','una','un','el','la','los','las','y',
        'del','de','en','al','se','es','su','sus','más','mejor','nuevo','nuestra','nuestro'
    ]);

    const textSource = [name, desc, objective, market].filter(Boolean).join(' ');
    const cleaned = textSource
        .replace(/[\u00A0-\u9999<>\&\/\\.,;:()"\-—_]/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 3 && !stopwords.has(w));

    // Count frequency to surface relevant terms
    const freq = {};
    cleaned.forEach(w => freq[w] = (freq[w] || 0) + 1);
    const keywords = Object.keys(freq)
        .sort((a,b) => freq[b] - freq[a])
        .slice(0, 5)
        .map(k => k.charAt(0).toUpperCase() + k.slice(1));

    // Build focused lead sentence using available fields
    let lead = '';
    if (name) {
        lead = `${name} es${objective ? ' — ' + objective : ''}`;
    } else if (desc) {
        const firstSentence = desc.split(/[.\n]/).find(s => s.trim());
        lead = firstSentence ? firstSentence.trim() : desc.slice(0, 120);
    } else {
        lead = objective || 'Producto sin nombre';
    }

    // Compose value proposition with clear benefits tied to inputs
    const benefits = [];
    if (keywords.length) benefits.push(`${keywords.join(' · ')}`);
    if (objective) benefits.push('enfocado en: ' + objective);
    if (market) benefits.push('dirigido a: ' + market);

    const proposal = `${lead}. Propuesta de valor: ${benefits.join(' — ')}. Beneficio clave: reduce fricción y costos, mejora la adopción y entrega valor claro desde la primera experiencia.`;

    valueEl.value = proposal;

    // Keep in-memory product data consistent
    appData.product = appData.product || {};
    appData.product.productValue = proposal;

    showMessage('Propuesta de valor generada automáticamente', 'success', 3000);
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
window.generateValueProposal = generateValueProposal;

// New exports for report JSON and loading
window.addReportData = addReportData;
window.downloadDataJSON = downloadDataJSON;
window.loadReports = loadReports;

// New: AI report generation (local agent simulation)
function simulateAIAgent(data) {
    // Comprehensive professional synthesis using all available fields
    const p = data.product || {};
    const m = data.market || {};
    const f = data.features || {};
    const t = data.timeline || {};

    const mainFeatures = f.mainFeatures ? f.mainFeatures.split('\n').map(s => s.trim()).filter(Boolean) : [];
    const secondaryFeatures = f.secondaryFeatures ? f.secondaryFeatures.split('\n').map(s => s.trim()).filter(Boolean) : [];
    const futureFeatures = f.futureFeatures ? f.futureFeatures.split('\n').map(s => s.trim()).filter(Boolean) : [];
    const milestones = t.milestones ? t.milestones.split('\n').map(s => s.trim()).filter(Boolean) : [];

    // Extract concise insight bullets
    const insights = [];
    if (p.productObjective) insights.push(`Objetivo claro: ${p.productObjective}`);
    if (p.productValue) insights.push(`Propuesta de valor: ${p.productValue}`);
    if (m.targetMarket) insights.push(`Segmento objetivo: ${m.targetMarket}`);
    if (m.marketSize) insights.push(`Tamaño de mercado: ${m.marketSize}`);
    if (m.competition) insights.push(`Competidores clave: ${m.competition}`);
    if (t.duration) insights.push(`Duración propuesta: ${t.duration} semanas`);
    if (t.budget) insights.push(`Presupuesto estimado: $${t.budget}`);

    // Prioritization recommendation based on available features
    const prioritized = mainFeatures.slice(0, 5);
    const riskNotes = [];
    if (!p.productValue) riskNotes.push('Propuesta de valor poco definida — riesgo en comunicación a usuarios.');
    if (!m.targetMarket) riskNotes.push('Segmento objetivo no especificado — dificulta priorización comercial.');
    if (!mainFeatures.length) riskNotes.push('Falta definición de características núcleo — priorizar 3 funciones imprescindibles.');
    if (!t.duration || !t.team) riskNotes.push('Cronograma o equipo incompleto — validar recursos antes de comprometer hitos.');

    // Polished narrative sections
    const executive = `<strong>${p.productName || 'Producto sin nombre'}</strong> — Resumen ejecutivo: ${p.productObjective ? `${p.productObjective}.` : ''} Se propone un MVP minimalista que permita validar hipótesis de valor con usuarios reales en fases cortas y medibles.`;
    const description = `${p.productDesc ? `${p.productDesc}` : 'No se proporcionó descripción.'}` + (p.productValue ? ` Propuesta de valor: ${p.productValue}` : '');
    const marketAnalysis = `El mercado objetivo identificado es ${m.targetMarket || 'no especificado'}. ${m.marketSize ? `Tamaño estimado: ${m.marketSize}.` : ''} Competencia y posición: ${m.competition || 'no documentada'}. Ventaja competitiva declarada: ${m.advantage || 'no especificada'}. Recomendación: focalizar lanzamiento en subsegmentos con alta sensibilidad a precio y necesidad evidente del problema.`;
    const featuresSection = prioritized.length
        ? `<p>Características prioritarias a entregar en el MVP:</p><ul>${prioritized.map(x => `<li>${x}</li>`).join('')}</ul>`
        : `<p>No hay características principales definidas. Priorizar 3 funcionalidades que generen valor inmediato.</p>`;

    // Next steps and tactical plan
    const tactical = [
        'Validación rápida: Realizar entrevistas y pruebas con 10–20 usuarios objetivo para comprobar demanda.',
        'Prototipado y pruebas de usabilidad: iterar hasta alcanzar TTFV (tiempo hasta primer valor) bajo.',
        'Implementación en sprints de 2 semanas concentrando la ruta crítica (autenticación, flujo principal, métricas).',
        'Beta controlada: liberar a un grupo reducido, medir, corregir y escalar.'
    ];

    // Metrics and KPIs
    const metrics = [
        'Tasa de adopción inicial (días 0–7)',
        'Retención 7 / 30 días',
        'TTFV (tiempo hasta primer valor percep.)',
        'NPS o CSAT',
        'Conversiones a pago (si aplica)'
    ];

    // Compose elegant HTML
    const html = `
        <div class="report-section">
            <h3>Resumen Ejecutivo</h3>
            <p>${executive}</p>
            ${insights.length ? `<ul>${insights.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
        </div>

        <div class="report-section">
            <h3>Descripción y Propuesta de Valor</h3>
            <p>${description}</p>
        </div>

        <div class="report-section">
            <h3>Análisis de Mercado y Competencia</h3>
            <p>${marketAnalysis}</p>
        </div>

        <div class="report-section">
            <h3>Características del MVP y Priorización</h3>
            ${featuresSection}
            ${secondaryFeatures.length ? `<p>Características secundarias sugeridas:</p><ul>${secondaryFeatures.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
            ${futureFeatures.length ? `<p>Visión futura (v2+):</p><ul>${futureFeatures.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
        </div>

        <div class="report-section">
            <h3>Cronograma y Recursos</h3>
            <p>Duración estimada: ${t.duration ? t.duration + ' semanas' : 'No especificada'}.</p>
            <p>Equipo recomendado: ${t.team || 'No especificado'}.</p>
            <p>Presupuesto estimado: ${t.budget ? '$' + t.budget : 'No especificado'}.</p>
            ${milestones.length ? `<p>Hitos clave:</p><ul>${milestones.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
        </div>

        <div class="report-section">
            <h3>Plan de Acción (Próximos Pasos)</h3>
            <ol>${tactical.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>

        <div class="report-section">
            <h3>Métricas Recomendadas</h3>
            <ul>${metrics.map(m => `<li>${m}</li>`).join('')}</ul>
        </div>

        <div class="report-section">
            <h3>Riesgos y Mitigaciones</h3>
            ${riskNotes.length ? `<ul>${riskNotes.map(r => `<li>${r}</li>`).join('')}</ul>` : `<p>No se detectaron riesgos críticos con los datos proporcionados; revisar en siguientes iteraciones.</p>`}
        </div>

        <div class="report-section">
            <p style="margin-top: 16px; font-size:13px; color:#666;">
                Observaciones: este informe sintetiza los datos ingresados y ofrece priorización táctica y métricas claras para validar el MVP en fases. Generado por el Agente IA local de MVP Analyzer — ${new Date().toLocaleDateString('es-ES')}.
            </p>
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

function addReportData() {
    // Populate the report preview with currently saved data
    const sections = ['product','market','features','timeline'];
    const hasAny = sections.some(s => Object.keys(appData[s]).length > 0);
    const reportPreview = document.getElementById('reportPreview');
    if (!hasAny) {
        showMessage('No hay datos guardados para agregar al informe', 'error');
        return;
    }
    reportPreview.innerHTML = `<div class="report-content visible">${buildReportHTML()}</div>`;
    showMessage('Datos agregados al esquema del informe', 'success');
    navigateTo('report');
}

function downloadDataJSON() {
    // Download appData as JSON for backup
    try {
        const dataStr = JSON.stringify(appData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const fileName = (appData.product && appData.product.productName ? appData.product.productName : 'MVP_Data') + '_backup.json';
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 800);
        showMessage('Backup JSON descargado', 'success');
    } catch (err) {
        console.error('Error exporting JSON:', err);
        showMessage('Error al descargar JSON', 'error');
    }
}

function loadReports() {
    // Allow user to load a JSON backup and populate app
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result);
                // Validate minimal structure
                if (typeof json !== 'object' || json === null) throw new Error('JSON inválido');
                appData.product = json.product || {};
                appData.market = json.market || {};
                appData.features = json.features || {};
                appData.timeline = json.timeline || {};
                // fill forms
                fillFormFields('product');
                fillFormFields('market');
                fillFormFields('features');
                fillFormFields('timeline');
                updateProgress();
                showMessage('Informe cargado desde JSON', 'success');
                navigateTo('dashboard');
            } catch (err) {
                console.error('Error loading JSON:', err);
                showMessage('Error al cargar el archivo JSON', 'error');
            }
        };
        reader.readAsText(file, 'utf-8');
    });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
        document.body.removeChild(input);
    }, 1000);
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