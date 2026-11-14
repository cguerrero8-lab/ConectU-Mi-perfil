// Conecta U: lee perfiles JSON publicados por otros compañeros mediante solicitudes HTTP reales (fetch).

let miPerfil = {};
const $ = (id) => document.getElementById(id);
const norm = (t) => String(t).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = (t) => { const d = document.createElement("div"); d.textContent = String(t); return d.innerHTML; };

const CLAVES_NOMBRE = ["nombre", "name"];
const CLAVES_DESC = ["descripcion", "description", "bio"];

// ---------- Leer cualquier estructura JSON ----------
function buscar(obj, claves) {
  const k = Object.keys(obj || {}).find((x) => claves.includes(norm(x)));
  return k ? obj[k] : undefined;
}

// Convierte el perfil en pares [categoría, valor], sea cual sea su estructura
function aplanar(obj, prefijo = "", salida = []) {
  if (!obj || typeof obj !== "object") return salida;
  for (const [k, v] of Object.entries(obj)) {
    const kn = norm(k);
    if (!prefijo && (CLAVES_NOMBRE.includes(kn) || CLAVES_DESC.includes(kn))) continue;
    const cat = prefijo ? `${prefijo} › ${k}` : k;
    const items = Array.isArray(v) ? v : [v];
    for (const it of items) {
      if (it && typeof it === "object") aplanar(it, cat, salida);
      else if (it !== null && it !== undefined && String(it).trim() !== "") salida.push([cat, String(it).trim()]);
    }
  }
  return salida;
}

// ---------- Comparación ----------
function comparar(a, b) {
  const A = new Map(aplanar(a).map(([, v]) => [norm(v), v]));
  const B = new Map(aplanar(b).map(([, v]) => [norm(v), v]));
  const comunes = [...A.keys()].filter((v) => B.has(v));
  const base = Math.max(A.size, B.size);
  const porcentaje = base ? Math.round((comunes.length / base) * 100) : 0;

  const porCat = (p) => {
    const m = new Map();
    for (const [c, v] of aplanar(p)) m.set(norm(c), [...(m.get(norm(c)) || []), v]);
    return m;
  };
  const ca = porCat(a), cb = porCat(b), diferentes = [];
  for (const [cat, va] of ca) {
    const vb = cb.get(cat);
    if (!vb || va.length > 3 || vb.length > 3) continue;
    if (!va.some((x) => vb.map(norm).includes(norm(x)))) diferentes.push({ cat, mio: va, suyo: vb });
  }
  return { comunes: comunes.map((v) => A.get(v)), comunesSet: new Set(comunes), porcentaje, diferentes };
}

// ---------- Mi perfil ----------
function pintarResumen(p) {
  const cat = aplanar(p).filter(([c]) => norm(c) !== "gustos");
  const gustos = [].concat(p.gustos || []);
  $("resumen").innerHTML = `
    <dl><dt>Nombre</dt><dd>${esc(buscar(p, CLAVES_NOMBRE) ?? "—")}</dd>
    ${cat.map(([c, v]) => `<dt>${esc(c)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <p>${esc(buscar(p, CLAVES_DESC) ?? "")}</p>
    <ul class="chips">${gustos.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`;
}

function pintarFormulario(p) {
  $("nombre").value = buscar(p, CLAVES_NOMBRE) || "";
  $("descripcion").value = buscar(p, CLAVES_DESC) || "";
  for (const id of ["musica", "comida", "pasatiempo"]) $(id).value = p[id] || "";
  $("gustos").value = [].concat(p.gustos || []).join(", ");
}

function leerFormulario() {
  const p = { nombre: $("nombre").value.trim(), descripcion: $("descripcion").value.trim() };
  for (const id of ["musica", "comida", "pasatiempo"]) if ($(id).value.trim()) p[id] = $(id).value.trim();
  p.gustos = $("gustos").value.split(",").map((g) => g.trim()).filter(Boolean);
  return p;
}

$("form-perfil").addEventListener("submit", (e) => {
  e.preventDefault();
  const p = leerFormulario(), msg = $("msg-perfil");
  if (p.gustos.length < 5) {
    msg.className = "msg";
    msg.textContent = `Faltan gustos: tienes ${p.gustos.length} y se necesitan al menos 5.`;
    return;
  }
  miPerfil = p;
  pintarResumen(p);
  msg.className = "msg ok";
  msg.textContent = "Perfil guardado. Descárgalo y reemplaza perfil.json en tu hosting para publicarlo.";
});

$("descargar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(leerFormulario(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "perfil.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

// Mi propio perfil se lee también desde mi perfil.json publicado
fetch("perfil.json", { cache: "no-store" })
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
  .then((p) => { miPerfil = p; pintarResumen(p); pintarFormulario(p); })
  .catch(() => {
    $("resumen").innerHTML = '<p class="msg">No se pudo cargar perfil.json. Revisa que esté junto a index.html.</p>';
  });

// ---------- Consultar compañeros ----------
function tarjetaError(url, motivo) {
  const art = document.createElement("article");
  art.className = "res error";
  art.innerHTML = `<h3>No se pudo consultar este perfil</h3><p>${esc(motivo)}</p><p class="meta">${esc(url)}</p>`;
  return art;
}

function tarjetaPerfil(url, p, estado) {
  const yo = buscar(miPerfil, CLAVES_NOMBRE) || "Yo";
  const otro = buscar(p, CLAVES_NOMBRE) || "Compañero";
  const r = comparar(miPerfil, p);
  const datos = aplanar(p);
  const items = [
    ...r.comunes.map((v) => `<li class="si">Ambos coinciden en ${esc(v)}</li>`),
    ...r.diferentes.map((d) => `<li class="no">En ${esc(d.cat)}: ${esc(d.mio.join(", "))} (${esc(yo)}) / ${esc(d.suyo.join(", "))} (${esc(otro)})</li>`),
  ];
  const art = document.createElement("article");
  art.className = "res";
  art.innerHTML = `
    <h3>${esc(yo)} + ${esc(otro)}</h3>
    <div class="pct">${r.porcentaje}%</div>
    <div class="pct-et">Compatibilidad de gustos</div>
    <div class="barra"><span style="width:${r.porcentaje}%"></span></div>
    <ul class="coin">${items.join("") || '<li class="vacio">No hay coincidencias para mostrar.</li>'}</ul>
    <div class="otro">
      <h4>Perfil recibido de ${esc(otro)}</h4>
      <p>${esc(buscar(p, CLAVES_DESC) ?? "")}</p>
      <ul class="chips">${datos.map(([c, v]) => `<li class="${r.comunesSet.has(norm(v)) ? "comun" : ""}" title="${esc(c)}">${esc(v)}</li>`).join("")}</ul>
      <details><summary>Ver JSON recibido</summary><pre>${esc(JSON.stringify(p, null, 2))}</pre></details>
      <p class="meta">Solicitud HTTP real a ${esc(url)} · respuesta ${estado} · ${new Date().toLocaleTimeString()}</p>
    </div>`;
  return art;
}

async function consultar(url) {
  try {
    const u = new URL(url);                       // valida la URL
    const resp = await fetch(u.href, { cache: "no-store" });
    if (!resp.ok) return tarjetaError(url, `El servidor respondió con el código ${resp.status}. Revisa que la URL exista.`);
    let datos;
    try { datos = await resp.json(); }
    catch { return tarjetaError(url, "La URL respondió, pero el contenido no es un JSON válido."); }
    if (!datos || typeof datos !== "object") return tarjetaError(url, "El JSON no contiene un perfil (se esperaba un objeto).");
    return tarjetaPerfil(url, datos, resp.status);
  } catch (err) {
    const motivo = err instanceof TypeError && /URL/i.test(err.message)
      ? "La dirección no es una URL válida. Debe empezar por https://"
      : "El navegador bloqueó la consulta. Causas probables: ese hosting no permite CORS (falta la cabecera Access-Control-Allow-Origin), la URL está mal escrita o el sitio no responde.";
    return tarjetaError(url, motivo);
  }
}

$("form-url").addEventListener("submit", async (e) => {
  e.preventDefault();
  const urls = [...new Set($("url").value.split(/[\s,]+/).filter(Boolean))];
  const btn = $("btn-consultar"), estado = $("estado");
  btn.disabled = true;
  estado.className = "msg info";
  estado.textContent = `Consultando ${urls.length} perfil(es)…`;

  const tarjetas = await Promise.all(urls.map(consultar));
  const fallos = tarjetas.filter((t) => t.classList.contains("error")).length;
  const lista = $("lista");
  tarjetas.reverse().forEach((t) => lista.prepend(t));

  estado.className = fallos ? "msg" : "msg ok";
  estado.textContent = fallos
    ? `${urls.length - fallos} consulta(s) exitosa(s) y ${fallos} con problemas. Revisa los resultados.`
    : "Consulta exitosa. Los datos llegaron desde el JSON del compañero.";
  $("limpiar").hidden = false;
  btn.disabled = false;
  $("resultados").scrollIntoView({ behavior: "smooth" });
});

$("limpiar").addEventListener("click", () => { $("lista").innerHTML = ""; $("limpiar").hidden = true; $("estado").textContent = ""; });
