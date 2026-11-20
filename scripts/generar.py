# /// script
# dependencies = ["pillow"]
# ///
"""Genera las partes estáticas del portfolio a partir de datos/proyectos.json.

Uso (desde la raíz del repo):  uv run scripts/generar.py

Qué hace, y es idempotente:
  1. Reduce las capturas de assets/screens que pasen del ancho útil (banners a 1400 px, capturas a 900 px).
  2. Escribe en index.html, entre marcadores <!-- gen:... -->, las tarjetas de proyectos y de webs abiertas, los
     botones de series con su recuento, las cifras de la cabecera, el texto del terminal, el enlace del pie y el
     JSON-LD. Así Google ve todo el contenido sin ejecutar JavaScript.
  3. Escribe sitemap.xml y robots.txt.

Para añadir una web: añade su objeto a «abiertas» en datos/proyectos.json (con «serie», sin «featured»), deja el
banner en assets/screens y vuelve a ejecutar este script.
"""
from __future__ import annotations

import html
import json
import re
from datetime import date
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SITIO = "https://pedri77.github.io/"
DATOS = json.loads((RAIZ / "datos/proyectos.json").read_text(encoding="utf-8"))
PROYECTOS, ABIERTAS = DATOS["proyectos"], DATOS["abiertas"]
SERIES = [("todas", "Todas"), ("cultura", "Cultura y dominio público"), ("ciber", "Ciberseguridad"), ("ciencia", "Ciencia y datos"), ("ia", "IA")]

GH_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><use href="#i-gh"/></svg>'
LINK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><use href="#i-link"/></svg>'


def reducir_capturas() -> int:
    """Banners muy apaisados a 1400 px de ancho; capturas de pantalla a 900 px. Devuelve cuántas cambió."""
    cambiadas = 0
    for p in PROYECTOS + ABIERTAS:
        f = RAIZ / p["img"] if p.get("img") else None
        if not f or not f.exists():
            continue
        im = Image.open(f)
        tope = 1400 if im.width / im.height > 3 else 900
        if im.width <= tope:
            continue
        im = im.convert("RGB")
        im.thumbnail((tope, tope), Image.LANCZOS)
        im.save(f, "WEBP", quality=74, method=6)
        cambiadas += 1
    return cambiadas


def tamano(img: str) -> tuple[int, int]:
    with Image.open(RAIZ / img) as im:
        return im.size


def tarjeta(p: dict, i: int) -> str:
    """Mismo marcado que pintaba renderCards() en el navegador."""
    clases = ["project-card", "reveal"]
    if p.get("featured"):
        clases.append("featured")
    if p.get("serie") and not p.get("featured"):
        clases.append("compacta")
    if p["status"] == "archived":
        clases.append("archivado")
    estilo = f"transition-delay:{min(i, 6) * 0.06:.2f}s;--card-color:{p['color']}"
    if p.get("wide"):
        estilo += ";grid-column:1 / -1"
    serie = f' data-serie="{p["serie"]}"' if p.get("serie") else ""
    partes = [f'<article class="{" ".join(clases)}"{serie} style="{estilo}">']
    if p.get("img"):
        w, h = tamano(p["img"])
        partes.append(f'<div class="card-media"><img src="{p["img"]}" alt="Captura de {html.escape(p["name"])}" width="{w}" height="{h}" loading="lazy" decoding="async"/></div>')
    partes.append(f'<div class="project-header"><h3 class="mono project-name" style="color:{p["color"]}">{p["name"]}</h3><span class="mono project-status status-{p["status"]}">{p["statusLabel"]}</span></div>')
    partes.append(f'<p class="project-desc">{p["desc"]}</p>')
    if p.get("url"):
        partes.append(f'<a href="https://{p["url"]}" target="_blank" rel="noopener" class="mono project-url">{p["url"]}</a>')
    partes.append('<div class="project-tags mono">' + "".join(f'<span class="project-tag">{t}</span>' for t in p["tags"]) + "</div>")
    if p["links"]:
        enlaces = "".join(f'<a href="{l["url"]}" target="_blank" rel="noopener" class="project-link">{GH_ICON if l.get("icon") == "gh" else LINK_ICON} {l["label"]}</a>' for l in p["links"])
        partes.append(f'<div class="project-links mono">{enlaces}</div>')
    partes.append('<div class="card-shine" aria-hidden="true"></div><div class="card-spot" aria-hidden="true"></div>' + ('<div class="card-beam" aria-hidden="true"></div>' if p.get("featured") else ""))
    partes.append("</article>")
    return "".join(partes)


def cifras() -> dict:
    vivos = [p for p in PROYECTOS if p["status"] == "live"]
    dominios = [p for p in vivos if p.get("url") and not re.match(r"(youtube\.com|github\.com)", p["url"])]
    return {"total": len(PROYECTOS) + len(ABIERTAS), "vivos": len(vivos), "webs": len(ABIERTAS), "dominios": len(dominios)}


def series() -> str:
    botones = []
    for clave, nombre in SERIES:
        n = len(ABIERTAS) if clave == "todas" else sum(1 for p in ABIERTAS if p.get("serie") == clave)
        pulsado = "true" if clave == "todas" else "false"
        botones.append(f'<button type="button" class="serie-btn" data-serie="{clave}" aria-pressed="{pulsado}">{nombre}<span>{n}</span></button>')
    return "".join(botones)


def demo(p: dict) -> str | None:
    for l in p["links"]:
        if l["url"].startswith(SITIO) and l["url"] != SITIO:
            return l["url"]
    return None


def json_ld() -> str:
    obras = [{"@type": "ListItem", "position": i + 1, "url": u, "name": p["name"]} for i, (p, u) in enumerate((p, demo(p)) for p in ABIERTAS) if u]
    datos = [
        {"@context": "https://schema.org", "@type": "Person", "name": "David Moya García", "url": SITIO, "jobTitle": "Fundador y CTO de Riskitera",
         "sameAs": ["https://github.com/pedri77", "https://www.linkedin.com/in/david-moya-b3a77547"]},
        {"@context": "https://schema.org", "@type": "ItemList", "name": "Webs y herramientas abiertas", "itemListElement": obras},
    ]
    return "\n".join(f'<script type="application/ld+json">{json.dumps(d, ensure_ascii=False)}</script>' for d in datos)


def bloque(texto: str, nombre: str, contenido: str) -> str:
    patron = re.compile(rf"(<!-- gen:{nombre} -->).*?(<!-- /gen:{nombre} -->)", re.S)
    assert patron.search(texto), f"falta el marcador gen:{nombre}"
    return patron.sub(lambda m: m.group(1) + contenido + m.group(2), texto)


def main() -> None:
    print("capturas reducidas:", reducir_capturas())
    c = cifras()
    f = RAIZ / "index.html"
    t = f.read_text(encoding="utf-8")
    t = bloque(t, "proyectos", "\n" + "\n".join(tarjeta(p, i) for i, p in enumerate(PROYECTOS)) + "\n")
    t = bloque(t, "abiertas", "\n" + "\n".join(tarjeta(p, i) for i, p in enumerate(ABIERTAS)) + "\n")
    t = bloque(t, "series", series())
    t = bloque(t, "jsonld", "\n" + json_ld() + "\n")
    t = bloque(t, "pie", f"Las {c['webs']} webs &darr;")
    for clave in ("total", "vivos", "webs", "dominios"):
        t = bloque(t, f"cifra-{clave}", f'<div class="mono stat-val" data-count="{c[clave]}">{c[clave]}</div>')
    t, n = re.subn(r"var ESTADO = '[^']*';", f"var ESTADO = '{c['total']} proyectos · {c['vivos']} en producción · soberanía UE';", t)
    assert n == 1, "falta la línea var ESTADO en index.html"
    f.write_text(t, encoding="utf-8")

    urls = [SITIO] + sorted({u for u in (demo(p) for p in ABIERTAS) if u})
    hoy = date.today().isoformat()
    filas = "\n".join(f"  <url><loc>{html.escape(u)}</loc><lastmod>{hoy}</lastmod></url>" for u in urls)
    (RAIZ / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{filas}\n</urlset>\n', encoding="utf-8")
    (RAIZ / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITIO}sitemap.xml\n", encoding="utf-8")
    print("cifras:", c, "· urls en sitemap:", len(urls))


if __name__ == "__main__":
    main()
