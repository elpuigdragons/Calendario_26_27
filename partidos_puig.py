#!/usr/bin/env python3
"""
Extrae del panel de resultados de https://www.hockeylinea.fpcv.es/ solo los
partidos de un equipo (por defecto PUIG, que incluye PUIGB, PUIG16, etc.).

Cada vez que lo ejecutas, actualiza salida/partidos_puig.csv: los partidos
nuevos se anaden y los que ya estaban se actualizan (resultado, estado...).

Instalacion (una sola vez):
    pip install playwright
    playwright install chromium

Uso:
    python partidos_puig.py
    python partidos_puig.py --team PUIG
    python partidos_puig.py --click "Temporada 2026/27"   # si hay que elegir temporada
    python partidos_puig.py --debug --headed              # para diagnosticar

NOTA: esta primera version se ha escrito a partir de una captura de pantalla,
sin ver el HTML real del panel. Si alguna fila sale mal, ejecuta con --debug
y revisa salida/debug_texto.txt y salida/debug_filas.txt.
"""
import argparse
import csv
import json
import re
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "https://www.hockeylinea.fpcv.es/"

# Busca los elementos cuyo texto es exactamente un equipo (PUIG, PUIGB...),
# sube hasta la "fila" del partido (el mayor bloque con una sola fecha que
# comparte contenedor con otras filas con fecha) y averigua su categoria.
FIND_JS = r"""
(team) => {
  const esc = team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const leafRe = new RegExp('^' + esc + '\\w*$', 'i');
  const hasDate = /\d{2}\/\d{2}/;
  const txt = (e) => (e.innerText || '');

  const hasSiblingWithDate = (el) => {
    for (const s of el.parentElement.children) {
      if (s !== el && hasDate.test(txt(s))) return true;
    }
    return false;
  };

  const category = (row) => {
    let el = row;
    for (let d = 0; d < 6 && el && el !== document.body; d++, el = el.parentElement) {
      let s = el.previousElementSibling;
      while (s) {
        const t = txt(s).trim();
        if (t && !hasDate.test(t) && t.length < 60) return t.replace(/\s+/g, ' ');
        s = s.previousElementSibling;
      }
    }
    return '';
  };

  const leaves = Array.from(document.querySelectorAll('body *'))
    .filter(e => leafRe.test(txt(e).trim()));

  const rows = new Set();
  for (const leaf of leaves) {
    let el = leaf;
    while (el.parentElement && el.parentElement !== document.body) {
      if (hasDate.test(txt(el)) && hasSiblingWithDate(el)) break;
      el = el.parentElement;
    }
    if (hasDate.test(txt(el))) rows.add(el);
  }
  return Array.from(rows).map(el => ({categoria: category(el), texto: txt(el)}));
}
"""

STATUS_RE = re.compile(
    r"SIN\s+COMENZAR|SUSPENDIDO|APLAZADO|DESCANSO|FINAL|PERIODO\s*\d+", re.I
)
JORNADA_RE = re.compile(r"\bJOR(?:NADA)?\.?\s*(\d+)", re.I)
DATE_RE = re.compile(r"(\d{2}/\d{2})(?:[ \t]+(\d{1,2}:\d{2}))?")
SCORE_RE = re.compile(r"(\d+)\s*:\s*(\d+)")

COLUMNS = ["capturado", "categoria", "fecha", "hora", "local", "visitante",
           "goles_local", "goles_visitante", "estado", "jornada", "texto_original"]


def parse_row(item, ahora):
    text = item["texto"]
    t = text

    m = DATE_RE.search(t)
    fecha, hora = (m.group(1), m.group(2) or "") if m else ("", "")
    if m:
        t = t.replace(m.group(0), "\n", 1)

    m = STATUS_RE.search(t)
    estado = re.sub(r"\s+", " ", m.group(0)).upper() if m else ""
    if m:
        t = t.replace(m.group(0), "\n", 1)

    m = JORNADA_RE.search(t)
    jornada = m.group(1) if m else ""
    if m:
        t = t.replace(m.group(0), "\n", 1)

    m = SCORE_RE.search(t)
    gl, gv = (m.group(1), m.group(2)) if m else ("", "")
    if m:
        t = t.replace(m.group(0), "\n", 1)

    # Lo que queda son nombres: los dos ultimos son local y visitante,
    # lo anterior (si lo hay) es la cabecera de categoria.
    tokens = [x.strip() for x in t.splitlines() if len(x.strip()) > 1]
    if len(tokens) < 2:
        return None
    local, visitante = tokens[-2], tokens[-1]
    categoria = " ".join(tokens[:-2]) or item["categoria"]

    return {
        "capturado": ahora,
        "categoria": categoria,
        "fecha": fecha,
        "hora": hora,
        "local": local,
        "visitante": visitante,
        "goles_local": gl,
        "goles_visitante": gv,
        "estado": estado,
        "jornada": jornada,
        "texto_original": " | ".join(x.strip() for x in text.splitlines() if x.strip()),
    }


def key(r):
    return (r["fecha"], r["local"], r["visitante"])


def sort_key(r):
    try:
        d, mth = r["fecha"].split("/")
        return (int(mth), int(d), r["hora"])
    except ValueError:
        return (99, 99, r["hora"])


def upsert(path: Path, rows):
    existing = {}
    if path.exists():
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                existing[key(r)] = r
    for r in rows:
        existing[key(r)] = r
    merged = sorted(existing.values(), key=sort_key)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(merged)
    return len(merged)


def click_text(page, text):
    for fr in page.frames:
        try:
            loc = fr.locator("a").filter(has_text=text)
            if loc.count() > 0:
                loc.first.evaluate("e => e.click()")
                return True
        except Exception:
            continue
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--team", default="PUIG", help="Prefijo del equipo (PUIG incluye PUIGB...).")
    ap.add_argument("--url", default=URL)
    ap.add_argument("--click", help='Texto de un enlace a pulsar antes, p. ej. "Temporada 2026/27".')
    ap.add_argument("--out", default="salida")
    ap.add_argument("--delay", type=float, default=4.0, help="Segundos de espera tras cargar.")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page()
        page.goto(args.url)
        try:
            page.wait_for_load_state("networkidle", timeout=20000)
        except Exception:
            pass
        page.wait_for_timeout(int(args.delay * 1000))

        if args.click:
            if not click_text(page, args.click):
                print(f"Aviso: no encontre el enlace '{args.click}'")
            page.wait_for_timeout(int(args.delay * 1000))

        items = []
        for fr in page.frames:
            try:
                items += fr.evaluate(FIND_JS, args.team)
            except Exception:
                pass

        if args.debug:
            textos = []
            for i, fr in enumerate(page.frames):
                try:
                    textos.append(f"===== frame {i}: {fr.url}\n{fr.inner_text('body')}")
                except Exception:
                    pass
            (out / "debug_texto.txt").write_text("\n\n".join(textos), encoding="utf-8")
            (out / "debug_filas.txt").write_text(
                json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        browser.close()

    ahora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rows = [r for r in (parse_row(i, ahora) for i in items) if r]
    # Por si el filtro de equipo captura alguna fila donde no juega el equipo
    pref = args.team.upper()
    rows = [r for r in rows
            if r["local"].upper().startswith(pref) or r["visitante"].upper().startswith(pref)]

    if not rows:
        print("No encontre partidos. Prueba con --debug --headed y revisa salida/debug_texto.txt")
        return

    total = upsert(out / "partidos_puig.csv", rows)
    (out / "ultima_extraccion.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"{len(rows)} partidos de {args.team} encontrados ({total} en el historico):\n")
    for r in sorted(rows, key=sort_key):
        res = f"{r['goles_local']}:{r['goles_visitante']}" if r["goles_local"] else "-"
        print(f"{r['fecha']} {r['hora']:>5}  {r['local']:>7} {res:^7} {r['visitante']:<7} "
              f"{r['estado']:<14} J{r['jornada']}  [{r['categoria']}]")


if __name__ == "__main__":
    main()
