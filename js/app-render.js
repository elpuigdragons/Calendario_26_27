const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSl5xg397GTfLDogRcVZAXObRrp8JH7-j5YAlel0hNU1Sb33IS_WT0KxKDY_5fNKuL_YWnqUubSiG25/pub?gid=795521530&single=true&output=csv";

let localMatches = [];
let activeCategory = "todos";
let activeStatus = "proximos";

function parseFlexibleDate(dateStr) {
    if (!dateStr) return null;
    dateStr = dateStr.trim();
    if (dateStr.includes('-')) {
        return new Date(dateStr + "T00:00:00");
    }
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(`${year}-${month}-${day}T00:00:00`);
    }
    return new Date(dateStr);
}

// Convertidor de filas CSV seguro ante mapas y comillas tipográficas
function splitCSVRow(rowText) {
    const fields = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < rowText.length; i++) {
        const c = rowText[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
            fields.push(field.trim().replace(/^"|"$/g, ''));
            field = '';
        } else {
            field += c;
        }
    }
    fields.push(field.trim().replace(/^"|"$/g, ''));
    return fields;
}

async function loadSheetsData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        const rows = csvText.split(/\r?\n/);
        const parsedMatches = [];

        // Empezamos en 1 para saltar la fila de títulos
        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            const cols = splitCSVRow(rows[i]);
            if (cols.length < 8) continue;

            const categoria = cols[0];
            const fechaStr = cols[1];
            const fechaObj = parseFlexibleDate(fechaStr);
            const hora = cols[2];
            const instalacion = cols[3];
            const jornada = cols[4];
            const local = cols[5];
            const visitante = cols[6];
            const res = cols[7] || "-";
            const mapaUrl = cols[8] || "";

            if (!fechaObj || !categoria) continue;

            // Determinar balance W/L/D para los Dragons
            let outcome = "pending";
            const cleanRes = res.replace(/\s+/g, '');
            if (cleanRes && cleanRes !== "-" && cleanRes.includes('-')) {
                const parts = cleanRes.split('-');
                if (parts.length === 2) {
                    const scoreLocal = parseInt(parts[0], 10);
                    const scoreVisitante = parseInt(parts[1], 10);
                    const isLocalDragons = local.toUpperCase().includes("DRAGONS");

                    if (!isNaN(scoreLocal) && !isNaN(scoreVisitante)) {
                        if (scoreLocal === scoreVisitante) outcome = "draw";
                        else if ((scoreLocal > scoreVisitante && isLocalDragons) || (scoreVisitante > scoreLocal && !isLocalDragons)) {
                            outcome = "win";
                        } else {
                            outcome = "loss";
                        }
                    }
                }
            }

            parsedMatches.push({
                categoria, fechaStr, fechaObj, hora, instalacion, jornada,
                equipoLocal: local, equipoVisitante: visitante, resultado: res === "" ? "-" : res,
                outcome, mapaUrl
            });
        }
        return parsedMatches;
    } catch (error) {
        console.error("Error cargando Google Sheets:", error);
        return [];
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    localMatches = await loadSheetsData();
    initFilters();
    initStatusTabs();
    updateView();
    setupNextMatchCountdown();
});

function initFilters() {
    const chips = document.querySelectorAll("#category-filters .chip");
    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            activeCategory = chip.getAttribute("data-category");
            updateView();
        });
    });
}

function initStatusTabs() {
    const tabs = document.querySelectorAll("#status-tabs .tab-btn");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeStatus = tab.getAttribute("data-status");
            updateView();
        });
    });
}

function updateView() {
    const container = document.getElementById("matches-list");
    container.innerHTML = "";

    const now = new Date();
    now.setHours(0,0,0,0);

    const filtered = localMatches.filter(m => {
        const matchCategory = activeCategory === "todos" || m.categoria.toLowerCase().includes(activeCategory.toLowerCase());
        const hasResult = m.resultado !== "-" && m.resultado !== "";
        let matchStatus = true;
        
        if (activeStatus === "proximos") {
            matchStatus = !hasResult && m.fechaObj >= now;
        } else if (activeStatus === "resultados") {
            matchStatus = hasResult || m.fechaObj < now;
        }
        return matchCategory && matchStatus;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">No hay partidos disponibles en esta sección.</div>`;
        return;
    }

    if (activeStatus === "proximos") {
        filtered.sort((a, b) => a.fechaObj - b.fechaObj);
    } else {
        filtered.sort((a, b) => b.fechaObj - a.fechaObj);
    }

    let currentMonthYear = "";
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    filtered.forEach(match => {
        const mesText = `${meses[match.fechaObj.getMonth()]} ${match.fechaObj.getFullYear()}`;
        if (mesText !== currentMonthYear) {
            currentMonthYear = mesText;
            const heading = document.createElement("h2");
            heading.className = "month-heading";
            heading.textContent = currentMonthYear;
            container.appendChild(heading);
        }

        const isBlanco = match.categoria.toLowerCase().includes("blanco");
        const dotColorClass = isBlanco ? "blanco" : "negro";
        const dayNumber = String(match.fechaObj.getDate()).padStart(2, '0');
        const diasSemana = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
        const dayOfWeek = diasSemana[match.fechaObj.getDay()];

        const renderTeamName = (name) => name.toUpperCase().includes("DRAGONS") ? `<span class="dragons">${name}</span>` : name;

        const fixtureDiv = document.createElement("div");
        fixtureDiv.className = "fixture";
        fixtureDiv.innerHTML = `
            <div class="date">
                <span class="day">${dayNumber}</span>
                <span class="wd">${dayOfWeek}</span>
            </div>
            <div class="info">
                <div class="tags">
                    <span class="team-dot ${dotColorClass}"></span>
                    <span class="cat-tag">${match.categoria}</span>
                    <span class="jor-tag">${match.jornada}</span>
                </div>
                <div class="teams">
                    ${renderTeamName(match.equipoLocal)} <span class="vs">vs</span> ${renderTeamName(match.equipoVisitante)}
                </div>
                <div class="venue">
                    <span class="hora">${match.hora ? match.hora.substring(0,5) : 'Por def.'}</span> · ${match.instalacion}
                </div>
            </div>
            <div class="right-col">
                <span class="result-badge ${match.outcome}">
                    ${match.resultado === "-" ? '<span class="pending">PENDIENTE</span>' : match.resultado}
                </span>
                ${match.mapaUrl ? `<a href="${match.mapaUrl}" target="_blank" class="map-link">🗺️ Ubicación</a>` : ''}
            </div>
        `;
        container.appendChild(fixtureDiv);
    });
}

function setupNextMatchCountdown() {
    const section = document.getElementById("next-match-section");
    const countdownContainer = document.getElementById("countdown-container");
    const listContainer = document.getElementById("nm-list-container");

    const now = new Date();
    const futureMatches = localMatches.filter(m => m.resultado === "-" && m.fechaObj >= now);

    if (futureMatches.length === 0) {
        section.style.display = "none";
        return;
    }

    futureMatches.sort((a, b) => a.fechaObj - b.fechaObj);
    const nextMatch = futureMatches[0];
    section.style.display = "block";

    const isLocalDragons = nextMatch.equipoLocal.toUpperCase().includes("DRAGONS");
    listContainer.innerHTML = `
        <div class="nm-item">
            <div class="tag-row">
                <span class="cat-label">${nextMatch.categoria} · ${nextMatch.jornada}</span>
            </div>
            <div class="matchup">
                ${isLocalDragons ? `<span class="dragons">${nextMatch.equipoLocal}</span>` : nextMatch.equipoLocal}
                <span class="vs">VS</span>
                ${!isLocalDragons ? `<span class="dragons">${nextMatch.equipoVisitante}</span>` : nextMatch.equipoVisitante}
            </div>
            <div class="meta">📍 ${nextMatch.instalacion} a las <strong>${nextMatch.hora ? nextMatch.hora.substring(0,5) : '--:--'}</strong></div>
        </div>
    `;

    let matchDateTime = new Date(nextMatch.fechaObj);
    if (nextMatch.hora) {
        const parts = nextMatch.hora.split(":");
        matchDateTime.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0);
    }

    function updateClock() {
        const t = matchDateTime - new Date();
        if (t <= 0) {
            countdownContainer.innerHTML = "<span class='pending'>¡EN JUEGO!</span>";
            return;
        }
