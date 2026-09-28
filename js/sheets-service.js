// REEMPLAZA ESTO CON TU ENLACE LARGO DE GOOGLE SHEETS (DEBE TERMINAR EN ?output=csv)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSl5xg397GTfLDogRcVZAXObRrp8JH7-j5YAlel0hNU1Sb33IS_WT0KxKDY_5fNKuL_YWnqUubSiG25/pub?gid=795521530&single=true&output=csv";

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

async function loadSheetsData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        
        // Separamos filas evitando romper celdas complejas
        const rows = csvText.split(/\r?\n/).slice(1); 
        
        return rows.map(row => {
            const columns = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*\$)/);
            if(columns.length < 7) return null;

            const local = columns[5]?.replace(/"/g, '').trim() || "";
            const visitante = columns[6]?.replace(/"/g, '').trim() || "";
            const res = columns[7]?.replace(/"/g, '').trim() || "-";

            // Lógica inteligente para saber el resultado (Victoria, Derrota, Empate)
            let outcome = "pending";
            if (res && res !== "-" && res !== "") {
                const parts = res.split('-');
                if(parts.length === 2) {
                    const scoreLocal = parseInt(parts[0]);
                    const scoreVisitante = parseInt(parts[1]);
                    const isLocalDragons = local.toUpperCase().includes("DRAGONS");
                    
                    if(scoreLocal === scoreVisitante) outcome = "draw";
                    else if((scoreLocal > scoreVisitante && isLocalDragons) || (scoreVisitante > scoreLocal && !isLocalDragons)) {
                        outcome = "win";
                    } else {
                        outcome = "loss";
                    }
                }
            }

            return {
                categoria: columns[0]?.trim(),
                fechaStr: columns[1]?.trim(),
                fechaObj: parseFlexibleDate(columns[1]),
                hora: columns[2]?.trim() || "",
                instalacion: columns[3]?.trim(),
                jornada: columns[4]?.trim(),
                equipoLocal: local,
                equipoVisitante: visitante,
                resultado: res === "" ? "-" : res,
                outcome: outcome,
                mapaUrl: columns[8]?.replace(/"/g, '').trim() || ""
            };
        }).filter(item => item !== null && item.fechaObj !== null);
    } catch (error) {
        console.error("Error al descargar Google Sheets:", error);
        return [];
    }
}
