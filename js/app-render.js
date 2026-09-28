let localMatches = [];
let activeCategory = "todos";
let activeStatus = "proximos";

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
        container.innerHTML = `<div class="empty-state">No hay partidos disponibles con este filtro.</div>`;
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
                ${match.mapaUrl ? `<a href="\${match.mapaUrl}" target="_blank" class="map-link">🗺️ Ubicación</a>` : ''}
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
    const nextMatch = futureMatches[0]; // Corrección para tomar el primer partido inminente
    section.style.display = "block";

    const isLocalDragons = nextMatch.equipoLocal.toUpperCase().includes("DRAGONS");
    listContainer.innerHTML = `
        <div class="nm-item">
            <div class="tag-row">
                <span class="cat-label">${nextMatch.categoria} · ${nextMatch.jornada}</span>
            </div>
            <div class="matchup">
                ${isLocalDragons ? `<span class="dragons">\${nextMatch.equipoLocal}</span>` : nextMatch.equipoLocal}
                <span class="vs">VS</span>
                ${!isLocalDragons ? `<span class="dragons">\${nextMatch.equipoVisitante}</span>` : nextMatch.equipoVisitante}
            </div>
            <div class="meta">📍 ${nextMatch.instalacion} a las <strong>${nextMatch.hora ? nextMatch.hora.substring(0,5) : '--:--'}</strong></div>
        </div>
    `;

    let matchDateTime = new Date(nextMatch.fechaObj);
    if (nextMatch.hora) {
        const [h, m] = nextMatch.hora.split(":");
        matchDateTime.setHours(parseInt(h, 10), parseInt(m, 10), 0);
    }

    function updateClock() {
        const t = matchDateTime - new Date();
        if (t <= 0) {
            countdownContainer.innerHTML = "<span class='pending'>¡EN JUEGO!</span>";
            return;
        }
        const days = Math.floor(t / (1000 * 60 * 60 * 24));
        const hours = Math.floor((t / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((t / 1000 / 60) % 60);

        countdownContainer.innerHTML = `
            <div class="unit"><div class="num">${days}</div><div class="u-label">DÍAS</div></div>
            <div class="unit"><div class="num">${hours}</div><div class="u-label">HORAS</div></div>
            <div class="unit"><div class="num">${mins}</div><div class="u-label">MINS</div></div>
        `;
    }
    
    updateClock();
    setInterval(updateClock, 60000);
}
