<h1 align="center">pedri77.github.io</h1>

<p align="center">
  <strong>David Moya García — Portfolio of cybersecurity and AI projects.</strong>
</p>

<p align="center">
  <a href="https://pedri77.github.io"><img src="https://img.shields.io/badge/🌐_Live_Site-Open_Portfolio-06b6d4?style=for-the-badge&labelColor=0f172a" alt="Live Site"/></a>
  &nbsp;
  <a href="https://github.com/pedri77/pedri77.github.io"><img src="https://img.shields.io/badge/GitHub-Source_Code-c084fc?style=for-the-badge&logo=github&labelColor=0f172a" alt="Source"/></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3"/>
  <img src="https://img.shields.io/badge/GitHub_Pages-222?style=flat-square&logo=githubpages&logoColor=white" alt="GitHub Pages"/>
</p>

---

## `> cat overview.md`

Sitio portfolio personal desplegado en GitHub Pages. Presenta proyectos de ciberseguridad, IA y desarrollo web.

---

## `> tree src/`

```
pedri77.github.io/
├── index.html          # Pagina principal (tarjetas generadas en estatico)
├── 404.html            # Pagina de error personalizada
├── datos/proyectos.json  # Proyectos y webs abiertas
├── scripts/generar.py  # Vuelca los datos en index.html, sitemap.xml y robots.txt
├── scripts/og.mjs      # Genera assets/og.jpg
├── sitemap.xml
└── robots.txt
```

---

## `> cat datos.md`

Las tarjetas no se pintan con JavaScript: están escritas en `index.html` para que los buscadores las lean. Los datos viven en `datos/proyectos.json` y se vuelcan con dos scripts:

```bash
uv run scripts/generar.py   # tarjetas, series, cifras, JSON-LD, sitemap.xml y robots.txt; reduce capturas grandes
node scripts/og.mjs         # assets/og.jpg, la imagen al compartir (necesita playwright-core y Chrome)
```

Para añadir una web: su objeto en `abiertas` (con `serie`: cultura, ciber, ciencia o ia; sin `featured`), el banner en `assets/screens/` y volver a ejecutar `generar.py`. No se edita a mano nada entre los marcadores `<!-- gen:… -->`.

## `> cat deploy.md`

Desplegado automaticamente en **GitHub Pages** desde la rama `main`.

```bash
git clone https://github.com/pedri77/pedri77.github.io.git
cd pedri77.github.io
python3 -m http.server 8080
```

---

<p align="center">
  <a href="https://pedri77.github.io"><img src="https://img.shields.io/badge/🌐_Open_Portfolio-06b6d4?style=for-the-badge&labelColor=0f172a" alt="Open Portfolio"/></a>
</p>

<p align="center">
  <sub>Part of the <a href="https://github.com/pedri77">pedri77</a> cybersecurity & AI portfolio.</sub>
</p>
