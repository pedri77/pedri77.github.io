// Genera assets/og.jpg (1200×630), la imagen que se ve al compartir el portfolio, con las cifras de datos/proyectos.json.
// Uso: node scripts/og.mjs   (necesita playwright-core, global o local, y Google Chrome instalado)
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try {
  ({chromium} = await import('playwright-core'));
} catch {
  const require = createRequire(import.meta.url);
  const raices = [join(dirname(process.execPath), '..', 'lib', 'node_modules'), '/opt/homebrew/lib/node_modules', '/usr/local/lib/node_modules'];
  const candidatos = [process.env.PLAYWRIGHT_CORE, ...raices.flatMap((r) => [`${r}/playwright-core`, `${r}/@playwright/cli/node_modules/playwright-core`])].filter(Boolean);
  for (const c of candidatos) {
    try {
      ({chromium} = require(c));
      break;
    } catch {}
  }
}
if (!chromium) throw new Error('No encuentro playwright-core');

const {proyectos, abiertas} = JSON.parse(readFileSync(join(raiz, 'datos/proyectos.json'), 'utf8'));
const vivos = proyectos.filter((p) => p.status === 'live');
const dominios = vivos.filter((p) => p.url && !/^(youtube\.com|github\.com)/.test(p.url)).map((p) => p.url);
const cifra = (n, t) => `<div><b>${n}</b><span>${t}</span></div>`;
const fuentes = pathToFileURL(join(raiz, 'assets/fonts')).href;

const html = `<!doctype html><html lang="es"><meta charset="utf-8"><style>
@font-face{font-family:JB;font-weight:700;src:url('${fuentes}/JetBrainsMono-700-latin.woff2')}
@font-face{font-family:JB;font-weight:400;src:url('${fuentes}/JetBrainsMono-400-latin.woff2')}
@font-face{font-family:Plex;font-weight:400;src:url('${fuentes}/IBMPlexSans-400-latin.woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:radial-gradient(60% 70% at 0% 0%,rgba(6,182,212,.14),transparent 70%),radial-gradient(40% 50% at 100% 100%,rgba(192,132,252,.12),transparent 70%),#060810;color:#e2e8f0;font-family:Plex;padding:72px 84px;display:flex;flex-direction:column}
.cmd{font-family:JB;font-size:22px;color:#64748b}
h1{font-family:JB;font-weight:700;font-size:84px;letter-spacing:-2px;margin-top:18px}
h1 em{font-style:normal;color:#06b6d4}
.lema{font-size:26px;color:#94a3b8;margin-top:14px;max-width:960px;line-height:1.35}
.cifras{display:flex;gap:64px;margin-top:44px}
.cifras b{display:block;font-family:JB;font-size:54px;color:#06b6d4}
.cifras span{font-family:JB;font-size:16px;letter-spacing:2px;text-transform:uppercase;color:#64748b}
.dom{margin-top:auto;font-family:JB;font-size:19px;color:#0e7490}
.dom i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#34d399;margin-right:14px;vertical-align:2px}
</style><body>
<p class="cmd">pedri77@github:~$ whoami</p>
<h1>David Moya <em>García</em></h1>
<p class="lema">Ciberseguridad e IA, y webs de divulgación con datos abiertos y material de dominio público.</p>
<div class="cifras">${cifra(proyectos.length + abiertas.length, 'proyectos')}${cifra(vivos.length, 'en producción')}${cifra(abiertas.length, 'webs abiertas')}</div>
<p class="dom"><i></i>${dominios.slice(0, 5).join('&nbsp;&nbsp;&nbsp;')}</p>
</body></html>`;

const tmp = join(raiz, '.og-tmp.html');
writeFileSync(tmp, html);
const navegador = await chromium.launch({channel: 'chrome'});
const pagina = await navegador.newPage({viewport: {width: 1200, height: 630}});
await pagina.goto(pathToFileURL(tmp).href);
await pagina.evaluate(() => document.fonts.ready);
await pagina.screenshot({path: join(raiz, 'assets/og.jpg'), type: 'jpeg', quality: 86});
await navegador.close();
const {unlinkSync} = await import('node:fs');
unlinkSync(tmp);
console.log('assets/og.jpg generada');
