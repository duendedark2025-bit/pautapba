"use client";

import React, { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from "recharts";
import {
  ChevronDown, ChevronUp, Download, Eye, Link as LinkIcon,
  Maximize2, Minimize2, Moon, Sun, Camera
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ===================================
// Tipos y utilidades
// ===================================
type Registro = {
  Proveedor: string;
  Medio: string;
  Mes: string;
  Resolución: string;
  Importe: number;
  __Año?: number;
  __Fuente?: string;

  // Precomputados para búsqueda rápida
  __nMedio?: string;
  __nProveedor?: string;
  __nResolucion?: string;
  __mesCanon?: string;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// FIX VERCEL: sin \p{Diacritic}
const normalize = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function canonMonth(raw: string): string {
  const n = normalize(String(raw)).replace(/\./g, " ").replace(/\s+/g, " ").trim();
  if (n.startsWith("ene") || n.startsWith("jan")) return "enero";
  if (n.startsWith("feb")) return "febrero";
  if (n.startsWith("mar")) return "marzo";
  if (n.startsWith("abr") || n.startsWith("apr")) return "abril";
  if (n.startsWith("may")) return "mayo";
  if (n.startsWith("jun")) return "junio";
  if (n.startsWith("jul")) return "julio";
  if (n.startsWith("ago") || n.startsWith("aug")) return "agosto";
  if (n.startsWith("sep") || n.startsWith("set")) return "septiembre";
  if (n.startsWith("oct")) return "octubre";
  if (n.startsWith("nov")) return "noviembre";
  if (n.startsWith("dic") || n.startsWith("dec")) return "diciembre";
  const candidates = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
  ];
  const hit = candidates.find((m) => n === m);
  return hit || n;
}

const MONTHS_DESC = [
  "diciembre","noviembre","octubre","septiembre","agosto","julio",
  "junio","mayo","abril","marzo","febrero","enero"
] as const;

function monthRank(m: string): number { return MONTHS_DESC.indexOf(canonMonth(m) as any); }
function labelMonth(m: string): string { const c = canonMonth(m); return c.charAt(0).toUpperCase() + c.slice(1); }

function yearFromFilename(name: string): number {
  const m = name.match(/(20\d{2})/);
  return m ? parseInt(m[1], 10) : 0;
}

function firstLetterOf(name: string): string {
  if (!name) return "#";
  const ch = name.trim().charAt(0).toUpperCase();
  return ch >= "A" && ch <= "Z" ? ch : "#";
}

// Breakpoint simple
function useBreakpoint() {
  const [bp, setBp] = useState<"sm" | "md" | "lg" | "xl">("sm");
  useEffect(() => {
    const mds = [
      window.matchMedia("(min-width: 1280px)"),
      window.matchMedia("(min-width: 1024px)"),
      window.matchMedia("(min-width: 768px)"),
    ];
    const update = () => {
      if (mds[0].matches) setBp("xl");
      else if (mds[1].matches) setBp("lg");
      else if (mds[2].matches) setBp("md");
      else setBp("sm");
    };
    update();
    mds.forEach((m) => m.addEventListener("change", update));
    return () => mds.forEach((m) => m.removeEventListener("change", update));
  }, []);
  return bp;
}

// ===================================
// Mini componentes
// ===================================
function ValueLabel({
  x, y, value, dark, compact = false,
}: {
  x?: number; y?: number; value?: number | string; dark: boolean; compact?: boolean;
}) {
  if (typeof x !== "number" || typeof y !== "number" || value == null) return null;
  const num = Number(value);
  const txt = compact ? compactFormatter.format(num) : currencyFormatter.format(num);
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={12} fill={dark ? "#9ca3af" : "#6b7280"}>
      <tspan dy="-6">{txt}</tspan>
    </text>
  );
}

function SplashScreen({ dark, onDone }: { dark: boolean; onDone: () => void }) {
  const text = "#PAUTAPBA";
  const holdAfterMs = 1200;
  useEffect(() => {
    const t = setTimeout(onDone, holdAfterMs + text.length * 40);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className={`fixed inset-0 z-[9999] flex items-center justify-center ${dark ? "bg-black" : "bg-white"}`}
        style={{ overscrollBehavior: "none" }}
      >
        <div
          style={{
            fontSize: "clamp(52px, 12vw, 120px)",
            textAlign: "center",
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontWeight: 900,
            letterSpacing: ".01em",
          }}
          className={dark ? "text-white" : "text-black"}
        >
          {Array.from(text).map((ch, i) => (
            <span key={i} style={{ display: "inline-block", opacity: 0, animation: "letterIn 160ms ease-out forwards", animationDelay: `${i * 50}ms` }}>
              {ch}
            </span>
          ))}
        </div>
        <style jsx>{`
          @keyframes letterIn { from { opacity: 0 } to { opacity: 1 } }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}

// ===================================
// Página principal
// ===================================
export default function Page() {
  const bp = useBreakpoint();
  const [dark, setDark] = useState(true);
  const [splashVisible, setSplashVisible] = useState(true);

  // datos
  const [data, setData] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [queryInput, setQueryInput] = useState("");
  const queryDeferred = useDeferredValue(queryInput); // buscador suave

  // selección
  const [selectedMedium, setSelectedMedium] = useState<string | null>(null);

  // UI extra
  const [topOpen, setTopOpen] = useState(false);
  const [azOpen, setAzOpen] = useState(false);
  const [exportYear, setExportYear] = useState<"all" | number>("all");
  const [detailFullscreen, setDetailFullscreen] = useState(false);

  // charts
  type ChartMode = "yearTotals" | "monthsOfYear";
  const [chartMode, setChartMode] = useState<ChartMode>("yearTotals");
  const [chartYear, setChartYear] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // tema inicial
  useEffect(() => {
    const pref = typeof localStorage !== "undefined" ? localStorage.getItem("pba_theme") : null;
    const nextDark = pref !== "light";
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  }, []);

  function toggleTheme() {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try { localStorage.setItem("pba_theme", next ? "dark" : "light"); } catch {}
      return next;
    });
  }

  // fullscreen sync
  useEffect(() => {
    const onFsChange = () => setDetailFullscreen(!!document.fullscreenElement && document.fullscreenElement === detailRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // cargar data de /public/data
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      const defaults = [
        { url: "/data/pauta_bsas_2023.json", name: "pauta_bsas_2023.json" },
        { url: "/data/pauta_bsas_2024.json", name: "pauta_bsas_2024.json" },
        { url: "/data/pauta_bsas_2025.json", name: "pauta_bsas_2025.json" },
      ];
      const chunks: Registro[] = [];
      for (const f of defaults) {
        try {
          const res = await fetch(f.url, { cache: "force-cache" });
          if (!res.ok) continue;
          const json = await res.json();
          const year = yearFromFilename(f.name);
          for (const r of json as Registro[]) chunks.push({ ...r, __Año: r.__Año ?? year, __Fuente: f.name });
        } catch {}
      }
      // precompute normalizados
      const pre = chunks.map((r) => ({
        ...r,
        __nMedio: normalize(r.Medio),
        __nProveedor: normalize(r.Proveedor),
        __nResolucion: normalize(r.Resolución),
        __mesCanon: canonMonth(r.Mes),
      }));
      if (!canceled) { setData(pre); setLoading(false); }
    })();
    return () => { canceled = true; };
  }, []);

  const availableYears = useMemo(() => {
    const s = new Set<number>();
    data.forEach((d) => d.__Año && s.add(d.__Año));
    return Array.from(s).sort((a, b) => a - b);
  }, [data]);

  // agregaciones
  const totalsByYear = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of data) {
      const y = r.__Año || 0;
      m.set(y, (m.get(y) || 0) + (Number(r.Importe) || 0));
    }
    return Array.from(m.entries())
      .filter(([y]) => y > 0)
      .sort((a, b) => a[0] - b[0])
      .map(([y, t]) => ({ year: y, total: t }));
  }, [data]);

  const DETAIL_MONTHS_ORDER = MONTHS_DESC;
  const totalsByMonthAllYears = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data) {
      const mes = r.__mesCanon || canonMonth(r.Mes);
      m.set(mes, (m.get(mes) || 0) + (Number(r.Importe) || 0));
    }
    return DETAIL_MONTHS_ORDER.map((mes) => ({ mes: labelMonth(mes), total: m.get(mes) || 0 }));
  }, [data]);

  const totalsByMonthOfYear = useMemo(() => {
    const y = chartYear ?? availableYears[0];
    const m = new Map<string, number>();
    for (const r of data) {
      if (r.__Año === y) {
        const mes = r.__mesCanon || canonMonth(r.Mes);
        m.set(mes, (m.get(mes) || 0) + (Number(r.Importe) || 0));
      }
    }
    const rows = DETAIL_MONTHS_ORDER.map((mes) => ({ mes: labelMonth(mes), total: m.get(mes) || 0 }));
    return { year: y, rows };
  }, [data, chartYear, availableYears]);

  // top 50 por total
  type TopMedio = { Medio: string; y2023: number; y2024: number; y2025: number; total: number };
  const top50AllYears: TopMedio[] = useMemo(() => {
    const map = new Map<string, { y2023: number; y2024: number; y2025: number; total: number }>();
    for (const r of data) {
      const medio = r.Medio?.trim() || r.Proveedor?.trim() || "—";
      const y = r.__Año || 0;
      const imp = Number(r.Importe) || 0;
      if (!map.has(medio)) map.set(medio, { y2023: 0, y2024: 0, y2025: 0, total: 0 });
      const acc = map.get(medio)!;
      if (y === 2023) acc.y2023 += imp;
      else if (y === 2024) acc.y2024 += imp;
      else if (y === 2025) acc.y2025 += imp;
      acc.total += imp;
    }
    const arr: TopMedio[] = Array.from(map.entries()).map(([Medio, v]) => ({ Medio, ...v }));
    arr.sort((a, b) => b.total - a.total || a.Medio.localeCompare(b.Medio));
    return arr.slice(0, 50);
  }, [data]);

  // A–Z cards con criterio por año
  const azCards = useMemo(() => {
    const acc = new Map<string, { y2023: number; y2024: number; y2025: number; total: number; criterio: number }>();
    for (const r of data) {
      const medio = r.Medio?.trim() || r.Proveedor?.trim();
      if (!medio) continue;
      if (!acc.has(medio)) acc.set(medio, { y2023: 0, y2024: 0, y2025: 0, total: 0, criterio: 0 });
      const a = acc.get(medio)!;
      const imp = Number(r.Importe) || 0;
      if (r.__Año === 2023) a.y2023 += imp;
      if (r.__Año === 2024) a.y2024 += imp;
      if (r.__Año === 2025) a.y2025 += imp;
      a.total += imp;
    }
    const rows = Array.from(acc.entries()).map(([Medio, v]) => {
      const criterio = yearFilter === "all" ? v.total :
        (yearFilter === 2023 ? v.y2023 : yearFilter === 2024 ? v.y2024 : v.y2025);
      return { Medio, ...v, criterio };
    });
    rows.sort((a, b) => b.criterio - a.criterio || a.Medio.localeCompare(b.Medio));
    return rows;
  }, [data, yearFilter]);

  const letters = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")] as const;
  type Letter = typeof letters[number] | "ALL";
  const [azLetter, setAzLetter] = useState<Letter>("ALL");
  const azFiltered = useMemo(() => {
    if (azLetter === "ALL") return azCards;
    return azCards.filter((c) => firstLetterOf(c.Medio) === azLetter);
  }, [azCards, azLetter]);

  // detalle filtrado (useDeferredValue + precomputados)
  const filteredDetail = useMemo(() => {
    const q = normalize(queryDeferred || "");
    let arr = data;
    if (q) {
      arr = arr.filter((r) =>
        (r.__nMedio?.includes(q)) ||
        (r.__nProveedor?.includes(q)) ||
        (r.__nResolucion?.includes(q)) ||
        (r.__mesCanon?.includes(q))
      );
    }
    if (yearFilter !== "all") arr = arr.filter((r) => r.__Año === yearFilter);

    if (yearFilter !== "all") {
      const sums = new Map<string, number>();
      arr.forEach((r) => {
        const m = r.Medio || r.Proveedor;
        sums.set(m, (sums.get(m) || 0) + (Number(r.Importe) || 0));
      });
      arr = [...arr].sort((a, b) => {
        const sa = sums.get(a.Medio || a.Proveedor) || 0;
        const sb = sums.get(b.Medio || b.Proveedor) || 0;
        if (sb !== sa) return sb - sa;
        if ((b.__Año || 0) !== (a.__Año || 0)) return (b.__Año || 0) - (a.__Año || 0);
        return monthRank(a.__mesCanon || a.Mes) - monthRank(b.__mesCanon || b.Mes);
      });
    } else {
      arr = [...arr].sort((a, b) => {
        if ((b.__Año || 0) !== (a.__Año || 0)) return (b.__Año || 0) - (a.__Año || 0);
        const mr = monthRank(a.__mesCanon || a.Mes) - monthRank(b.__mesCanon || b.Mes);
        if (mr !== 0) return mr;
        return (Number(b.Importe) || 0) - (Number(a.Importe) || 0);
      });
    }
    return arr;
  }, [data, queryDeferred, yearFilter]);

  const proveedoresCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) {
      if (yearFilter === "all" || r.__Año === yearFilter) {
        const p = (r.Proveedor || "").trim();
        if (p) set.add(p);
      }
    }
    return set.size;
  }, [data, yearFilter]);

  function onYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value === "all" ? "all" : Number(e.target.value);
    setYearFilter(value as any);
    setExportYear(value as any);
    setSelectedMedium(null);
    setQueryInput("");
  }

  async function verAdjudicaciones(medio: string) {
    setQueryInput(medio);
    setSelectedMedium(medio);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    await toggleTrueFullscreen();
  }

  async function toggleTrueFullscreen() {
    const el = detailRef.current || document.documentElement;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.({ navigationUI: "hide" } as any);
      } else {
        await document.exitFullscreen?.();
      }
    } catch {}
  }

  async function captureJPG(target: "detalle" | "pagina" = "pagina") {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const node = target === "detalle" ? (detailRef.current ?? rootRef.current) : rootRef.current;
      if (!node) return;
      const canvas = await html2canvas(node, {
        backgroundColor: dark ? "#0b0f19" : "#f8fbff",
        scale: window.devicePixelRatio > 1 ? 2 : 1,
        useCORS: true,
        logging: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `captura-${target}-${stamp}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/jpeg", 0.92);
    } catch {
      alert("No se pudo generar la captura.");
    }
  }

  // charts config
  const NEON_RED = "#ff1744";
  const barColor = NEON_RED;
  const barSizeMain = bp === "sm" ? 22 : bp === "md" ? 30 : 38;
  const yAxisWidth = bp === "sm" ? 52 : bp === "md" ? 68 : 84;
  const showYearLabels = bp === "lg" || bp === "xl";
  const showMonthLabels = bp === "xl";

  useEffect(() => {
    if (chartMode === "monthsOfYear") {
      if (!chartYear) setChartYear(availableYears[0]);
    }
  }, [chartMode, availableYears, chartYear]);

  return (
    <div ref={rootRef} className={`${dark ? "bg-neutral-950 text-neutral-100" : "bg-white text-neutral-900"}`}>
      {splashVisible && <SplashScreen dark={dark} onDone={() => setSplashVisible(false)} />}

      {/* Header */}
      <header className={`sticky top-0 z-30 border-b ${dark ? "border-neutral-800" : "border-neutral-200"} header-grad backdrop-blur shadow-md rounded-b-xl`}>
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center justify-between gap-3">
            <button onClick={toggleTheme} aria-label="Cambiar tema" className="btn btn-soft flex items-center gap-2" title={dark ? "Modo claro" : "Modo oscuro"}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline text-sm">{dark ? "Claro" : "Oscuro"}</span>
            </button>
            <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[18px] sm:text-[20px] md:text-2xl font-extrabold tracking-tight">
              Pauta oficial provincia de Buenos Aires
            </motion.h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select className="btn btn-soft text-sm min-w-[200px]" value={exportYear as any} onChange={(e) => setExportYear(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">Exportar: Todos los años</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>Exportar: {y}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const slice = exportYear === "all" ? filteredDetail : filteredDetail.filter((r) => r.__Año === exportYear);
                const header = ["Medio", "Proveedor", "Mes", "Resolución", "Año", "Importe"];
                const rows = slice.map((r) => [
                  (r.Medio || "").replace(/"/g, '""'),
                  (r.Proveedor || "").replace(/"/g, '""'),
                  (r.Mes || "").replace(/"/g, '""'),
                  (r.Resolución || "").replace(/"/g, '""'),
                  r.__Año ?? "",
                  Number(r.Importe) || 0,
                ]);
                const csv = [header.join(","), ...rows.map((cols) => cols.map((v) => (typeof v === "string" ? `"${v}"` : String(v))).join(","))].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = exportYear === "all" ? "pauta_filtrada_todos.csv" : `pauta_filtrada_${exportYear}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn text-sm inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
            <button onClick={() => captureJPG("pagina")} className="btn text-sm inline-flex items-center gap-2" title="Capturar toda la página en JPG">
              <Camera className="h-4 w-4" /> Capturar JPG
            </button>
          </div>
        </div>
        <div className={`${dark ? "bg-neutral-900 text-neutral-100" : "bg-[#f0faff] text-[#0b4b66]"} border-t ${dark ? "border-neutral-800" : "border-[#bae6fd]"} py-2`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 text-[13px] md:text-[15px] font-medium text-center tracking-tight opacity-95">
            {yearFilter === "all" ? "Vista actual: Todos los años — Ordenado por total agregado" : `Vista actual: Año ${yearFilter} — Ordenado por medios con mayor total`}
          </div>
        </div>
      </header>

      {/* Toolbar de búsqueda */}
      <div data-ui="utility-toolbar" className="w-full">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex-1">
            <div className="search" role="search" style={{display:"flex",alignItems:"center",gap:10,border:"1px solid rgba(2,6,23,.14)",borderRadius:12,padding:"8px 12px"}}>
              <input
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Buscar (medio, proveedor, resolución, mes)..."
                aria-label="Buscar"
                style={{flex:1,background:"transparent",border:0,outline:0,fontSize:14}}
              />
              {queryInput ? (
                <button className="btn-ghost" onClick={() => { setQueryInput(""); setSelectedMedium(null); }} title="Limpiar">
                  ✕
                </button>
              ) : null}
              <button className="btn btn-primary text-sm inline-flex items-center gap-2 min-w-[108px] justify-center"
                onClick={() => { /* useDeferredValue aplica el filtro sin trabar el input */ }}>
                Buscar
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn text-sm inline-flex items-center gap-2" onClick={() => { try { navigator.clipboard?.writeText(location.href); alert("Enlace copiado."); } catch {} }}>
              Compartir
            </button>
            <button className="btn text-sm inline-flex items-center gap-2" onClick={() => { try { location.reload(); } catch {} }}>
              Refrescar
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-6 space-y-8">
        {/* Gráfico principal */}
        <section className={`card p-3 sm:p-4 ${dark ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200"}`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
            <div>
              <h3 className="text-lg sm:text-xl section-title">Gráfico principal</h3>
              <div className="text-xs sm:text-sm opacity-80 mt-1">
                {chartMode === "yearTotals" ? <>Todos los años</> : <>Meses del año {totalsByMonthOfYear.year}</>}
              </div>
              <div className="text-[11px] sm:text-xs mt-1 opacity-80">
                Proveedores en esta vista: <strong>{proveedoresCount.toLocaleString("es-AR")}</strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select className="btn btn-soft text-sm" value={chartMode} onChange={(e) => setChartMode(e.target.value as ChartMode)} title="Modo de gráfico">
                <option value="yearTotals">Todos los años</option>
                <option value="monthsOfYear">Meses del año</option>
              </select>
              <select aria-label="Filtrar por año" className="btn btn-soft text-sm" value={yearFilter as any} onChange={onYearChange}>
                <option value="all">Todos los años</option>
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              {chartMode === "monthsOfYear" && (
                <select className="btn btn-soft text-sm" value={(chartYear ?? availableYears[0]) as any} onChange={(e) => setChartYear(Number(e.target.value))}>
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="mt-3 h-56 sm:h-64 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "yearTotals" ? (
                <BarChart data={totalsByYear} barSize={barSizeMain} margin={{ top: 64, right: 12, bottom: 10, left: yAxisWidth }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={dark ? "#374151" : "#cfeffd"} />
                  <XAxis dataKey="year" stroke={dark ? "#d1d5db" : "#0b4b66"} />
                  <YAxis
                    width={yAxisWidth}
                    tick={{ fontSize: bp === "sm" ? 11 : 12, fill: dark ? "#d1d5db" : "#0b4b66" }}
                    domain={[0, (dataMax: number) => (dataMax || 0) * (bp === "sm" ? 1.12 : 1.18)]}
                    tickFormatter={(v) => currencyFormatter.format(v).replace(/^\$\s?/, "$")}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ background: dark ? "#0b1220" : "#f0fbff", border: `1px solid ${dark ? "#374151" : "#bae6fd"}`, color: dark ? "#fff" : "#0b4b66", padding: bp === "sm" ? 10 : 8 }}
                    formatter={(val: any) => currencyFormatter.format(Number(val))}
                    labelFormatter={(lbl) => `Año ${lbl}`}
                  />
                  <Bar dataKey="total" radius={[12, 12, 0, 0]} fill={NEON_RED}>
                    {showYearLabels && <LabelList dataKey="total" position="top" offset={10} content={(props: any) => <ValueLabel {...props} dark={dark} compact={false} />} />}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={yearFilter === "all" ? totalsByMonthAllYears : totalsByMonthOfYear.rows} barSize={bp === "sm" ? 20 : bp === "md" ? 26 : 32} margin={{ top: 64, right: 12, bottom: 10, left: yAxisWidth }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={dark ? "#374151" : "#cfeffd"} />
                  <XAxis
                    dataKey="mes"
                    stroke={dark ? "#d1d5db" : "#0b4b66"}
                    interval={0}
                    angle={bp === "sm" ? -35 : 0}
                    textAnchor={bp === "sm" ? "end" : "middle"}
                    tickMargin={8}
                    tick={{ fontSize: bp === "sm" ? 10 : 11, dy: bp === "sm" ? 8 : 0 }}
                  />
                  <YAxis
                    width={yAxisWidth}
                    tick={{ fontSize: bp === "sm" ? 11 : 12, fill: dark ? "#d1d5db" : "#0b4b66" }}
                    domain={[0, (dataMax: number) => (dataMax || 0) * (bp === "sm" ? 1.12 : 1.22)]}
                    tickFormatter={(v) => currencyFormatter.format(v).replace(/^\$\s?/, "$")}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ background: dark ? "#0b1220" : "#f0fbff", border: `1px solid ${dark ? "#374151" : "#bae6fd"}`, color: dark ? "#fff" : "#0b4b66", padding: bp === "sm" ? 10 : 8 }}
                    formatter={(val: any) => currencyFormatter.format(Number(val))}
                    labelFormatter={() => `Año ${totalsByMonthOfYear.year}`}
                  />
                  <Bar dataKey="total" radius={[12, 12, 0, 0]} fill={NEON_RED}>
                    {showMonthLabels && <LabelList dataKey="total" position="top" offset={10} content={(props: any) => <ValueLabel {...props} dark={dark} compact={true} />} />}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top 50 */}
        <section className={`card p-3 sm:p-4 ${dark ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200"}`}>
          <button onClick={() => setTopOpen((o) => !o)} className="w-full flex items-center justify-between btn btn-primary text-left" aria-expanded={topOpen}>
            <span className="font-semibold">Top 50 (todos los años)</span>
            {topOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence initial={false}>
            {topOpen && (
              <motion.div key="top50" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {top50AllYears.map((row, i) => (
                    <div key={row.Medio} className={`card p-3 ${dark ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${dark ? "bg-neutral-700" : "bg-neutral-100"}`}>{i + 1}</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => { navigator.clipboard?.writeText(location.origin + "#"+encodeURIComponent(row.Medio)); }} className="text-white/90 hover:text-white" title="Generar link">
                            <LinkIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => verAdjudicaciones(row.Medio)} className="text-blue-500" title="Ver adjudicaciones">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 text-sm">
                        <div>2023</div><div>{currencyFormatter.format(row.y2023)}</div>
                        <div>2024</div><div>{currencyFormatter.format(row.y2024)}</div>
                        <div>2025</div><div>{currencyFormatter.format(row.y2025)}</div>
                        <div className="font-medium mt-1">Total</div><div className="font-medium mt-1">{currencyFormatter.format(row.total)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* A–Z */}
        <section className={`card p-3 sm:p-4 ${dark ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200"}`}>
          <button onClick={() => setAzOpen((o) => !o)} className="w-full flex items-center justify-between btn btn-primary text-left" aria-expanded={azOpen}>
            <span className="font-semibold">Índice A–Z</span>
            {azOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence initial={false}>
            {azOpen && (
              <motion.div key="az" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mt-3">
                <div className="flex flex-wrap gap-2 mb-3">
                  {(["ALL", "#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")] as Letter[]).map((L) => (
                    <button key={String(L)} onClick={() => setAzLetter(L)} className={`chip ${azLetter === L ? "bg-blue-600 text-white" : ""}`}>
                      {String(L)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {azFiltered.map((card) => (
                    <div key={card.Medio} className={`card p-3 ${dark ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">{card.Medio}</div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => { navigator.clipboard?.writeText(location.origin + "#"+encodeURIComponent(card.Medio)); }} className="text-white/90 hover:text-white" title="Generar link">
                            <LinkIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => verAdjudicaciones(card.Medio)} className="text-blue-500" title="Ver adjudicaciones">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 text-sm">
                        <div>2023</div><div>{currencyFormatter.format(card.y2023)}</div>
                        <div>2024</div><div>{currencyFormatter.format(card.y2024)}</div>
                        <div>2025</div><div>{currencyFormatter.format(card.y2025)}</div>
                        <div className="font-medium mt-1">Total</div><div className="font-medium mt-1">{currencyFormatter.format(card.total)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Detalle */}
        <section ref={detailRef} className={`card p-3 sm:p-4 ${dark ? "bg-neutral-800 border border-neutral-700" : "bg-white border border-neutral-200"}`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 ${detailFullscreen ? "sticky top-0 pt-1 pb-2 z-[10000]" : ""}`}>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl section-title">Detalle de adjudicaciones</h3>
              <button onClick={toggleTrueFullscreen} className="btn text-sm inline-flex items-center gap-2" title={detailFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>
                {detailFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {detailFullscreen ? "Salir" : "Pantalla completa"}
              </button>
              <button onClick={() => captureJPG("detalle")} className="btn text-sm inline-flex items-center gap-2" title="Capturar este bloque en JPG">
                <Camera className="h-4 w-4" /> Capturar detalle
              </button>
            </div>
            <div className="text-sm opacity-80">{selectedMedium ? <>Medio: <strong>{selectedMedium}</strong></> : "Mostrando resultados filtrados"}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className={dark ? "bg-neutral-900" : "bg-neutral-100"}>
                  <th className="text-left p-2 border">Año</th>
                  <th className="text-left p-2 border">Mes</th>
                  <th className="text-left p-2 border">Medio</th>
                  <th className="text-left p-2 border">Proveedor</th>
                  <th className="text-left p-2 border">Resolución</th>
                  <th className="text-right p-2 border">Importe</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetail.map((r, i) => (
                  <tr key={i} data-card="detalle-item" className={i % 2 === 0 ? (dark ? "bg-neutral-800/60" : "bg-neutral-50") : undefined}>
                    <td className="p-2 border">{r.__Año ?? ""}</td>
                    <td className="p-2 border">{labelMonth(r.Mes)}</td>
                    <td className="p-2 border">{r.Medio}</td>
                    <td className="p-2 border">{r.Proveedor}</td>
                    <td className="p-2 border">{r.Resolución}</td>
                    <td className="p-2 border text-right">{currencyFormatter.format(Number(r.Importe) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <style jsx global>{`
        .btn { border-radius:12px; padding:9px 12px; border:1px solid rgba(2,6,23,.14); background:transparent; }
        .btn:hover{ background: rgba(2,6,23,.05); }
        .btn-primary{ background: #0ea5e9; color:#fff; border-color: #0284c7; }
        .chip { border-radius:999px; border:1px solid rgba(2,6,23,.14); padding:4px 10px; font-size:12px; }
        .card { border-radius:16px; border:1px solid rgba(2,6,23,.12); box-shadow: 0 10px 30px rgba(0,0,0,.06); }
        .search input::placeholder{ color:#6b7280 }
        :global(html.dark) .card{ border-color:#1f2937; background:#0b1220; }
        :global(html.dark) .btn{ border-color:#1f2937; }
        :global(html.dark) .btn:hover{ background:#0f172a; }
      `}</style>
    </div>
  );
}
