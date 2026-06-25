const SUPABASE_URL = "https://cyaaxchhzagtznrhktsl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5YWF4Y2hoemFndHpucmhrdHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mjc3NDIsImV4cCI6MjA5NzIwMzc0Mn0.6aEFyS6x39ZOjlmnByj6ULedMmeUS_nCAad0c7J_xYw";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allLeads = [];
let chartCategorias = null;
let chartEstados = null;

async function loadLeads() {
    const loading = document.getElementById("loadingState");
    const errorEl = document.getElementById("errorState");

    loading.style.display = "block";
    errorEl.style.display = "none";

    const { data, error } = await client
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

    loading.style.display = "none";

    if (error) {
        console.error("Error Supabase:", error);
        errorEl.style.display = "block";
        return;
    }

    // Si la columna estado no existe aún, asigna "Nuevo" como fallback
    allLeads = (data || []).map(l => ({ ...l, estado: l.estado ?? "Nuevo" }));

    updateStats(allLeads);
    renderTables(allLeads);
    renderCharts(allLeads);
    setupSearch();
}

// ── Estadísticas ─────────────────────────────────────────────
function updateStats(leads) {
    const alta = leads.filter(l => l.prioridad === "Alta").length;
    const proceso = leads.filter(l => l.estado === "En proceso").length;
    const completados = leads.filter(l => l.estado === "Completado").length;

    document.getElementById("totalLeads").textContent = leads.length;
    document.getElementById("altaLeads").textContent = alta;
    document.getElementById("procesoLeads").textContent = proceso;
    document.getElementById("completadosLeads").textContent = completados;
}

// ── Renderizar tablas ─────────────────────────────────────────
function renderTables(leads) {
    const activos = leads.filter(l => l.estado !== "Completado");
    const completados = leads.filter(l => l.estado === "Completado");

    renderRows("tablaLeads", activos);
    renderRows("tablaCompletados", completados);

    // Mostrar/ocultar sección completados
    const secComp = document.getElementById("seccionCompletados");
    secComp.style.display = completados.length > 0 ? "block" : "none";

    // Mostrar/ocultar sección análisis
    document.getElementById("analisisSection").style.display =
        leads.length > 0 ? "block" : "none";

    // Estado vacío en tabla activos
    document.getElementById("emptyState").style.display =
        activos.length === 0 ? "block" : "none";
}

function renderRows(tbodyId, leads) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = "";

    leads.forEach(lead => {
        const fecha = lead.created_at
            ? new Date(lead.created_at).toLocaleDateString("es-ES", {
                day: "2-digit", month: "short", year: "numeric"
            })
            : "–";

        const estadoSelect = `
            <select class="estado-select estado-${estadoClass(lead.estado)}"
                    data-id="${lead.id}"
                    onchange="cambiarEstado(this)"
                    aria-label="Estado del lead">
                <option value="Nuevo"      ${lead.estado === "Nuevo" ? "selected" : ""}>🔵 Nuevo</option>
                <option value="En proceso" ${lead.estado === "En proceso" ? "selected" : ""}>🟡 En proceso</option>
                <option value="Completado" ${lead.estado === "Completado" ? "selected" : ""}>🟢 Completado</option>
            </select>`;

        tbody.innerHTML += `
        <tr>
            <td><strong>${lead.nombre ?? "–"}</strong></td>
            <td><a href="mailto:${lead.email ?? ""}" class="email-link">${lead.email ?? "–"}</a></td>
            <td>${lead.empresa ?? "–"}</td>
            <td>${lead.categoria ?? "–"}</td>
            <td>${prioridadBadge(lead.prioridad)}</td>
            <td>${estadoSelect}</td>
            <td class="fecha-col">${fecha}</td>
        </tr>`;
    });
}

// ── Cambiar estado en bbdd ────────────────────────────────
async function cambiarEstado(selectEl) {
    const id = selectEl.dataset.id;
    const nuevoEstado = selectEl.value;

    // Actualizar clase visual de inmediato
    selectEl.className = `estado-select estado-${estadoClass(nuevoEstado)}`;

    const { error } = await client
        .from("leads")
        .update({ estado: nuevoEstado })
        .eq("id", id);

    if (error) {
        console.error("Error al actualizar estado:", error);
        alert("No se pudo guardar el estado. Revisa los permisos de Supabase.");
        return;
    }

    // Actualizar datos locales y re-renderizar
    allLeads = allLeads.map(l =>
        String(l.id) === String(id) ? { ...l, estado: nuevoEstado } : l
    );

    updateStats(allLeads);
    renderTables(allLeads);
    renderCharts(allLeads);
}

// ── Gráficas ─────────────────────────────────────────────────
function renderCharts(leads) {
    renderChartCategorias(leads);
    renderChartEstados(leads);
}

function renderChartCategorias(leads) {
    const conteo = {};
    leads.forEach(l => {
        const cat = l.categoria || "Sin categoría";
        conteo[cat] = (conteo[cat] || 0) + 1;
    });

    const labels = Object.keys(conteo);
    const values = Object.values(conteo);

    const ctx = document.getElementById("chartCategorias").getContext("2d");
    if (chartCategorias) chartCategorias.destroy();

    chartCategorias = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: ["#89CFF0", "#6366f1", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6"],
                borderWidth: 2,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { font: { family: "Inter", size: 12 }, padding: 16 } }
            },
            cutout: "62%"
        }
    });
}

function renderChartEstados(leads) {
    const estados = ["Nuevo", "En proceso", "Completado"];
    const valores = estados.map(e => leads.filter(l => l.estado === e).length);

    const ctx = document.getElementById("chartEstados").getContext("2d");
    if (chartEstados) chartEstados.destroy();

    chartEstados = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: estados,
            datasets: [{
                data: valores,
                backgroundColor: ["#89CFF0", "#f59e0b", "#10b981"],
                borderWidth: 2,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { font: { family: "Inter", size: 12 }, padding: 16 } }
            },
            cutout: "62%"
        }
    });
}

// ── Buscador ─────────────────────────────────────────────────
function setupSearch() {
    const input = document.getElementById("searchInput");
    input.addEventListener("input", () => {
        const q = input.value.toLowerCase().trim();
        const filtrados = allLeads.filter(l =>
            (l.nombre ?? "").toLowerCase().includes(q) ||
            (l.empresa ?? "").toLowerCase().includes(q) ||
            (l.email ?? "").toLowerCase().includes(q)
        );
        renderTables(filtrados);
    });
}

// ── Helpers ──────────────────────────────────────────────────
function prioridadBadge(prioridad) {
    if (!prioridad) return "–";
    const clase = prioridad === "Alta" ? "badge-alta"
        : prioridad === "Media" ? "badge-media"
            : "badge-baja";
    return `<span class="${clase}">${prioridad}</span>`;
}

function estadoClass(estado) {
    if (estado === "En proceso") return "proceso";
    if (estado === "Completado") return "completado";
    return "nuevo";
}

loadLeads();