"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Campana } from "@/types";
import { Building2, Plus, Edit2, Check, X, Save } from "lucide-react";

export default function CampanasPanel() {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Campana | null>(null);
  const [nueva, setNueva] = useState(false);
  const [formNueva, setFormNueva] = useState({ nombre: "", descripcion: "", horas_laborales_limite: 48 });

  const cargar = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("campanas").select("*").order("created_at", { ascending: false });
    if (data) setCampanas(data);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardarEdicion = async () => {
    if (!editando) return;
    const supabase = createClient();
    await supabase.from("campanas").update({
      nombre: editando.nombre,
      descripcion: editando.descripcion,
      horas_laborales_limite: editando.horas_laborales_limite,
      activa: editando.activa,
    }).eq("id", editando.id);
    setEditando(null);
    cargar();
  };

  const crearCampana = async () => {
    const supabase = createClient();
    await supabase.from("campanas").insert(formNueva);
    setNueva(false);
    setFormNueva({ nombre: "", descripcion: "", horas_laborales_limite: 48 });
    cargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="text-gray-500 text-sm mt-1">{campanas.length} campañas configuradas</p>
        </div>
        <button
          onClick={() => setNueva(true)}
          className="flex items-center gap-2 bg-[#003087] hover:bg-[#002060] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} />
          Nueva Campaña
        </button>
      </div>

      {/* Formulario nueva campaña */}
      {nueva && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Nueva Campaña</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={formNueva.nombre}
              onChange={(e) => setFormNueva((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Nombre de la campaña"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
            <input
              value={formNueva.descripcion}
              onChange={(e) => setFormNueva((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Descripción (opcional)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003087]"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formNueva.horas_laborales_limite}
                onChange={(e) => setFormNueva((p) => ({ ...p, horas_laborales_limite: parseInt(e.target.value) || 48 }))}
                min={1}
                max={200}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#003087]"
              />
              <span className="text-sm text-gray-500">horas límite agente</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={crearCampana}
              disabled={!formNueva.nombre.trim()}
              className="flex items-center gap-2 bg-[#003087] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-70"
            >
              <Save size={14} />
              Crear
            </button>
            <button
              onClick={() => setNueva(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Campaña</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Horas límite</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campanas.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {editando?.id === c.id ? (
                      <input
                        value={editando.nombre}
                        onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-blue-600" />
                        <span className="font-medium text-gray-800">{c.nombre}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editando?.id === c.id ? (
                      <input
                        value={editando.descripcion || ""}
                        onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                      />
                    ) : (
                      c.descripcion || <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editando?.id === c.id ? (
                      <input
                        type="number"
                        value={editando.horas_laborales_limite}
                        onChange={(e) => setEditando({ ...editando, horas_laborales_limite: parseInt(e.target.value) })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                        min={1}
                      />
                    ) : (
                      <span className="text-gray-700">{c.horas_laborales_limite}h</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editando?.id === c.id ? (
                      <select
                        value={editando.activa ? "true" : "false"}
                        onChange={(e) => setEditando({ ...editando, activa: e.target.value === "true" })}
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="true">Activa</option>
                        <option value="false">Inactiva</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.activa ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                        {c.activa ? "Activa" : "Inactiva"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {editando?.id === c.id ? (
                        <>
                          <button onClick={guardarEdicion} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditando(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setEditando({ ...c })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
