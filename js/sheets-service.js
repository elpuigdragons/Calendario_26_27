
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

// Procesa una línea CSV respetando comillas tipográficas complejas
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

async function loadSheetsData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        
        // Dividir por saltos de línea limpios
        const rows = csvText.split(/\r?\n/);
        if (rows.length <= 1) return [];

        const matches = [];

        // Saltamos la fila de cabecera (i = 1)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row.trim()) continue;

            const columns = parseCSVLine(row);
            if (columns.length < 8) continue; // Garantiza las columnas básicas

            const categoria = columns[0] || "";
            const fechaStr = columns[1] || "";
            const fechaObj = parseFlexibleDate(fechaStr);
            const hora = columns[2] || "";
            const instalacion = columns[3] || "";
            const jornada = columns[4] || "";
            const local = columns[5] || "";
            const visitante = columns[6] || "";
            const res = columns[7] || "-";
            const mapaUrl = columns[8] || "";

            // Omitir si la fila está rota o no tiene fecha válida
            if (!fechaObj || !categoria) continue;

            // Determinar balance de victorias/derrotas para iluminar los badges
            let outcome = "pending";
            const cleanRes = res.replace(/\s+/g, ''); // Quita espacios como "1 - 9" -> "1-9"
            
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
