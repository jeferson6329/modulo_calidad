"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/types";
import {
  Upload, Download, FileSpreadsheet, CheckCircle,
  AlertTriangle, X, ChevronLeft, Loader2,
} from "lucide-react";
import Link from "next/link";

interface FilaExcel {
  cedula: string;
  nombre: string;
  apellido: string;
  correo: string;
  supervisor_cedula: string;
  campana: string;
}

interface ResultadoFila extends FilaExcel {
  fila: number;
  accion: "CREAR" | "ACTUALIZAR" | "ERROR";
  mensaje?: string;
  supervisor_id?: string;
  campana_id?: string;
}

export default function CargaMasivaPanel({ perfil }: { perfil: Perfil }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<ResultadoFila[] | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [resumen, setResumen] = useState({ creados: 0, actualizados: 0, errores: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const descargarPlantilla = async () => {
    const supabase = createClient();

    // Obtener supervisores actuales
    const { data: supervisores } = await supabase
      .from("perfiles")
      .select("cedula, nombre, apellido, campana:campanas(nombre)")
      .eq("rol", "SUPERVISOR")
      .eq("activo", true);

    const { data: campanas } = await supabase.from("campanas").select("nombre").eq("activa", true);

    const XLSX = await import("xlsx");

    // Hoja 1: Plantilla para llenar
    const plantillaData = [
      ["cedula", "nombre", "apellido", "correo", "supervisor_cedula", "campana"],
      ["123456789", "Juan", "Pérez", "juan.perez@email.com", "987654321", campanas?.[0]?.nombre || "Nombre Campaña"],
    ];

    // Hoja 2: Supervisores disponibles
    const supervisoresData = [
      ["Cédula Supervisor", "Nombre", "Apellido", "Campaña"],
      ...(supervisores || []).map((s) => [
        s.cedula || "—",
        s.nombre,
        s.apellido,
        (s as any).campana?.nombre || "—",
      ]),
    ];

    // Hoja 3: Campañas disponibles
    const campanasData = [
      ["Nombre Campaña"],
      ...(campanas || []).map((c) => [c.nombre]),
    ];

    const wb = XLSX.utils.book_new();

    const wsPlantilla = XLSX.utils.aoa_to_sheet(plantillaData);
    wsPlantilla["!cols"] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsPlantilla, "Agentes");

    const wsSupervisores = XLSX.utils.aoa_to_sheet(supervisoresData);
    wsSupervisores["!cols"] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSupervisores, "Supervisores Disponibles");

    const wsCampanas = XLSX.utils.aoa_to_sheet(campanasData);
    XLSX.utils.book_append_sheet(wb, wsCampanas, "Campañas Disponibles");

    XLSX.writeFile(wb, "plantilla_carga_agentes.xlsx");
  };

  const leerArchivo = async (file: File) => {
    setArchivo(file);
    setPreview(null);
    setCargado(false);
    setProcesando(true);

    try {
      const XLSX = await import("xlsx");
      const supabase = createClient();

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filas: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      if (filas.length < 2) {
        alert("El archivo no tiene datos. Verifica que uses la plantilla correcta.");
        setProcesando(false);
        return;
      }

      // Validar encabezados
      const encabezados = filas[0].map((h: any) => String(h).toLowerCase().trim());
      const requeridos = ["cedula", "nombre", "apellido", "correo", "supervisor_cedula", "campana"];
      const faltantes = requeridos.filter((r) => !encabezados.includes(r));
      if (faltantes.length > 0) {
        alert(`Columnas faltantes: ${faltantes.join(", ")}. Descarga la plantilla correcta.`);
        setProcesando(false);
        return;
      }

      const idx = (col: string) => encabezados.indexOf(col);

      // Cargar supervisores y campañas para lookup
      const [{ data: supervisores }, { data: campanas }, { data: agentesExistentes }] = await Promise.all([
        supabase.from("perfiles").select("id, cedula").eq("rol", "SUPERVISOR"),
        supabase.from("campanas").select("id, nombre").eq("activa", true),
        supabase.from("perfiles").select("id, cedula, email").eq("rol", "AGENTE"),
      ]);

      const supMap = new Map((supervisores || []).map((s) => [s.cedula, s.id]));
      const camMap = new Map((campanas || []).map((c) => [c.nombre?.toLowerCase().trim(), c.id]));
      const agentesCedulaMap = new Map((agentesExistentes || []).map((a) => [a.cedula, a.id]));
      const agentesEmailMap  = new Map((agentesExistentes || []).map((a) => [a.email?.toLowerCase(), a.id]));

      const resultados: ResultadoFila[] = [];

      for (let i = 1; i < filas.length; i++) {
        const fila = filas[i];
        if (fila.every((c: any) => !c)) continue; // fila vacía

        const cedula           = String(fila[idx("cedula")] || "").trim();
        const nombre           = String(fila[idx("nombre")] || "").trim();
        const apellido         = String(fila[idx("apellido")] || "").trim();
        const correo           = String(fila[idx("correo")] || "").trim().toLowerCase();
        const supervisorCedula = String(fila[idx("supervisor_cedula")] || "").trim();
        const campana          = String(fila[idx("campana")] || "").trim();

        const resultado: ResultadoFila = {
          fila: i + 1, cedula, nombre, apellido, correo,
          supervisor_cedula: supervisorCedula, campana,
          accion: "CREAR",
        };

        // Validaciones
        if (!cedula)   { resultado.accion = "ERROR"; resultado.mensaje = "Cédula requerida"; resultados.push(resultado); continue; }
        if (!nombre)   { resultado.accion = "ERROR"; resultado.mensaje = "Nombre requerido"; resultados.push(resultado); continue; }
        if (!apellido) { resultado.accion = "ERROR"; resultado.mensaje = "Apellido requerido"; resultados.push(resultado); continue; }
        if (!correo || !correo.includes("@")) { resultado.accion = "ERROR"; resultado.mensaje = "Correo inválido"; resultados.push(resultado); continue; }

        // Buscar supervisor
        const supervisorId = supMap.get(supervisorCedula);
        if (supervisorCedula && !supervisorId) {
          resultado.accion = "ERROR";
          resultado.mensaje = `Supervisor con cédula ${supervisorCedula} no encontrado`;
          resultados.push(resultado);
          continue;
        }

        // Buscar campaña
        const campanaId = camMap.get(campana.toLowerCase());
        if (campana && !campanaId) {
          resultado.accion = "ERROR";
          resultado.mensaje = `Campaña "${campana}" no encontrada`;
          resultados.push(resultado);
          continue;
        }

        resultado.supervisor_id = supervisorId;
        resultado.campana_id    = campanaId;

        // ¿Existe el agente?
        const existePorCedula = agentesCedulaMap.has(cedula);
        const existePorEmail  = agentesEmailMap.has(correo);
        resultado.accion = (existePorCedula || existePorEmail) ? "ACTUALIZAR" : "CREAR";

        resultados.push(resultado);
      }

      setPreview(resultados);
    } catch (err: any) {
      alert("Error al leer el archivo: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const ejecutarCarga = async () => {
    if (!preview) return;
    setProcesando(true);

    const validos = preview.filter((r) => r.accion !== "ERROR");
    let creados = 0, actualizados = 0, errores = 0;
    const detalle: any[] = [];

    try {
      const res = await fetch("/api/usuarios/carga-masiva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filas: validos,
          nombreArchivo: archivo?.name || "archivo.xlsx",
        }),
      });
      const data = await res.json();
      creados     = data.creados     || 0;
      actualizados = data.actualizados || 0;
      errores     = data.errores     || 0;
      setCargado(true);
      setResumen({ creados, actualizados, errores });
    } catch (err: any) {
      alert("Error al procesar la carga: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const crearCount  = preview?.filter((r) => r.accion === "CREAR").length  || 0;
  const actuCount   = preview?.filter((r) => r.accion === "ACTUALIZAR").length || 0;
  const errorCount  = preview?.filter((r) => r.accion === "ERROR").length  || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/usuarios" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carga Masiva de Agentes</h1>
          <p className="text-gray-500 text-sm mt-0.5">Importa o actualiza agentes desde un archivo Excel</p>
        </div>
      </div>

      {/* Instrucciones + descarga plantilla */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <FileSpreadsheet size={18} /> Instrucciones
        </h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Descarga la plantilla Excel — incluye la lista de supervisores y campañas disponibles</li>
          <li>Llena los datos: cédula, nombre, apellido, correo, cédula del supervisor, nombre de campaña</li>
          <li>Sube el archivo. El sistema mostrará qué se va a crear y qué se va a actualizar</li>
          <li>Confirma la carga</li>
        </ol>
        <button
          onClick={descargarPlantilla}
          className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Download size={16} />
          Descargar plantilla Excel
        </button>
      </div>

      {/* Zona de carga */}
      {!cargado && (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) leerArchivo(f); }}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-10 text-center cursor-pointer transition bg-white"
        >
          {procesando ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-blue-600 animate-spin" />
              <p className="text-gray-500">Leyendo archivo...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={32} className="text-gray-400" />
              <p className="font-medium text-gray-700">
                {archivo ? archivo.name : "Arrastra el archivo aquí o haz clic para seleccionar"}
              </p>
              <p className="text-sm text-gray-400">Solo archivos .xlsx o .xls</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); }}
          />
        </div>
      )}

      {/* Preview */}
      {preview && !cargado && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{crearCount}</p>
              <p className="text-sm text-green-600">Se crearán</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{actuCount}</p>
              <p className="text-sm text-blue-600">Se actualizarán</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{errorCount}</p>
              <p className="text-sm text-red-600">Con errores</p>
            </div>
          </div>

          {/* Tabla de preview */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Vista previa de cambios</h3>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Fila</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Cédula</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Correo</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Campaña</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Acción</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Primero los que se van a actualizar, luego crear, luego errores */}
                  {[...preview].sort((a, b) => {
                    const orden = { ACTUALIZAR: 0, CREAR: 1, ERROR: 2 };
                    return orden[a.accion] - orden[b.accion];
                  }).map((r) => (
                    <tr key={r.fila} className={r.accion === "ERROR" ? "bg-red-50" : ""}>
                      <td className="px-4 py-2 text-gray-400 text-xs">{r.fila}</td>
                      <td className="px-4 py-2 font-medium text-gray-700">{r.cedula}</td>
                      <td className="px-4 py-2 text-gray-700">{r.nombre} {r.apellido}</td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{r.correo}</td>
                      <td className="px-4 py-2 text-gray-600 text-xs">{r.campana || "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          r.accion === "CREAR"      ? "bg-green-100 text-green-800" :
                          r.accion === "ACTUALIZAR" ? "bg-blue-100 text-blue-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {r.accion}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {r.mensaje && (
                          <span className="text-red-600">{r.mensaje}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setPreview(null); setArchivo(null); }}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition flex items-center gap-2"
            >
              <X size={15} />
              Cancelar
            </button>
            <button
              onClick={ejecutarCarga}
              disabled={procesando || (crearCount + actuCount) === 0}
              className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-70"
            >
              {procesando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {procesando ? "Procesando..." : `Confirmar carga (${crearCount + actuCount} registros)`}
            </button>
          </div>
        </div>
      )}

      {/* Resultado final */}
      {cargado && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
          <CheckCircle size={48} className="text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Carga completada</h2>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{resumen.creados}</p>
              <p className="text-sm text-gray-500">Creados</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{resumen.actualizados}</p>
              <p className="text-sm text-gray-500">Actualizados</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{resumen.errores}</p>
              <p className="text-sm text-gray-500">Errores</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setPreview(null); setArchivo(null); setCargado(false); }}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Cargar otro archivo
            </button>
            <Link
              href="/dashboard/usuarios"
              className="bg-[#003087] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#002060] transition"
            >
              Ver usuarios
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
