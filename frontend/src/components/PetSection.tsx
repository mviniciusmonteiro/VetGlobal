import React, { useState } from 'react';
import { createPet } from '../services/api';
import type { Pet } from '../services/api';
import { PawPrint, PlusCircle, Check, Loader2 } from 'lucide-react';

interface PetSectionProps {
  pets: Pet[];
  selectedPetId: number | null;
  onSelectPet: (petId: number) => void;
  onPetCreated: (newPet: Pet) => void;
}

export const PetSection: React.FC<PetSectionProps> = ({
  pets,
  selectedPetId,
  onSelectPet,
  onPetCreated,
}) => {
  const [showNewForm, setShowNewForm] = useState(false);
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ownerName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const created = await createPet(name, ownerName);
      onPetCreated(created);
      onSelectPet(created.id);
      setName('');
      setOwnerName('');
      setShowNewForm(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar pet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/75 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-6 transition-all duration-200 hover:border-white/20">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <PawPrint size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">1. Selecione ou Cadastre o Paciente</h2>
            <p className="text-xs text-slate-400">Identificação do pet e tutor responsável</p>
          </div>
        </div>

        <button
          id="btn-toggle-new-pet"
          type="button"
          onClick={() => setShowNewForm(!showNewForm)}
          className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 hover:border-white/30 rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
        >
          <PlusCircle size={14} />
          {showNewForm ? 'Cancelar' : 'Novo Pet'}
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleSubmit} className="bg-slate-950/60 p-4 rounded-xl border border-white/15 mb-5">
          <h3 className="text-sm font-semibold mb-3 text-emerald-400">
            Cadastrar Novo Pet (POST /pets)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">
                Nome do Pet *
              </label>
              <input
                id="input-pet-name"
                type="text"
                className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="Ex: Hank"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">
                Nome do Tutor *
              </label>
              <input
                id="input-owner-name"
                type="text"
                className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="Ex: John Bergeson"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-rose-400 text-xs mb-3 font-medium bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            id="btn-submit-pet"
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold py-2 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Cadastrar Paciente
          </button>
        </form>
      )}

      {pets.length === 0 ? (
        <div className="text-center py-4 text-slate-400 text-sm">
          Nenhum pet cadastrado no banco. Cadastre o primeiro acima!
        </div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
          {pets.map((p) => {
            const isSelected = selectedPetId === p.id;
            return (
              <button
                key={p.id}
                id={`btn-select-pet-${p.id}`}
                type="button"
                onClick={() => onSelectPet(p.id)}
                className={`min-w-[140px] p-3 text-left rounded-xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500 shadow-md shadow-emerald-500/15'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20'
                }`}
              >
                <div className={`font-semibold text-sm ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                  🐾 {p.name}
                </div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  Tutor: {p.owner_name}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  ID #{p.id}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
