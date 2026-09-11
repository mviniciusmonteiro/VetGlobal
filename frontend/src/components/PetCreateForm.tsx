import React, { useState } from 'react';
import { createPet } from '../services/api';
import type { Pet } from '../types';
import { Check, Loader2 } from 'lucide-react';

interface PetCreateFormProps {
  onSuccess: (newPet: Pet) => void;
}

export const PetCreateForm: React.FC<PetCreateFormProps> = ({ onSuccess }) => {
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
      onSuccess(created);
      setName('');
      setOwnerName('');
    } catch (err: any) {
      setError(err.message || 'Não foi possível cadastrar o paciente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-3 animate-in fade-in duration-150"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5 text-slate-800">
        Novo Registro de Paciente
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
        <div>
          <label className="block text-[11px] text-slate-600 mb-1 font-medium">
            Nome do Animal *
          </label>
          <input
            id="input-pet-name"
            type="text"
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 transition-all"
            placeholder="Ex: Hank"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-600 mb-1 font-medium">
            Tutor Responsável *
          </label>
          <input
            id="input-owner-name"
            type="text"
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 transition-all"
            placeholder="Ex: John Bergeson"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <div className="text-rose-700 text-xs mb-2.5 font-medium bg-rose-50 border border-rose-200 p-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        id="btn-submit-pet"
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium py-1.5 px-3 rounded-lg transition-all cursor-pointer disabled:opacity-50 text-xs shadow-2xs"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        Confirmar Cadastro
      </button>
    </form>
  );
};
