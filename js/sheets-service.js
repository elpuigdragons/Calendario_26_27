
// Enlace oficial de tu hoja de cálculo exportada en formato CSV
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

// Separador robusto que elimina comillas automáticas de Google Sheets
function cleanCSVCell(cell) {
    if (!cell) return "";
    return cell.replace(/^"|"\$/g, '').trim();
}

async function loadSheetsData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        
        const rows = csvText.split(/\r?\n/);
        if (rows.length <= 1) return [];

        const matches = [];

        // Empezamos en 1 para saltar las cabeceras
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row.trim()) continue;

            // Separar por comas respetando las comas internas de los enlaces de Google Maps
            const columns = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*\$)/);
            if (columns.length < 8) continue;

            const categoria = cleanCSVCell(columns[0]);
            const fechaStr = cleanCSVCell(columns[1]);
            const fechaObj = parseFlexibleDate(fechaStr);
            const hora = cleanCSVCell(columns[2]);
            const instalacion = cleanCSVCell(columns[3]);
            const jornada = cleanCSVCell(columns[4]);
            const local = cleanCSVCell(columns[5]);
            const visitante = cleanCSVCell(columns[6]);
            const res = cleanCSVCell(columns[7]);
            const mapaUrl = columns[8] ? cleanCSVCell(columns[8]) : "";

            if (!fechaObj || !categoria) continue;

            // Calcular si es victoria, derrota o empate para iluminar el marcador
            let outcome = "pending";
            const cleanRes = res.replace(/\s+/g, ''); 
            
            if (cleanRes && cleanRes !== "-" && cleanRes.includes('-')) {
                const parts = cleanRes.split('-');
                if (parts.length === 2) {
                    const scoreLocal = parseInt(parts[0], 10);
                    const scoreVisitante = parseInt(parts[1], 10);
                    const isLocalDragons = local.toUpperCase().includes("DRAGONS");

                    if (!isNaN(scoreLocal) && !isNaN(scoreVisitante)) {
                        if (scoreLocal === scoreVisitante) {
                            outcome = "draw";
                        } else if ((scoreLocal > scoreVisitante && isLocalDragons) || (scoreVisitante > scoreLocal && !isLocalDragons)) {
                            outcome = "win";
                        } else {
                            outcome = "loss";
                        }
                    }
                }
            }

            matches.push({
                categoria,
                fechaStr,
                fechaObj,
                hora,
                instalacion,
                jornada,
                equipoLocal: local,
                equipoVisitante: visitante,
                resultado: res === "" ? "-" : res,
                outcome,
                mapaUrl
            });
        }
        return matches;
    } catch (error) {
        console.error("Error crítico descargando el CSV:", error);
        return [];
    }
}

