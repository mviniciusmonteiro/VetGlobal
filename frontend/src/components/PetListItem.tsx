import React from 'react';
import type { Pet } from '../types';
import { User } from 'lucide-react';

interface PetListItemProps {
  pet: Pet;
  isSelected: boolean;
  photoUrl: string;
  onSelect: (petId: number) => void;
}

export const PetListItem: React.FC<PetListItemProps> = ({
  pet,
  isSelected,
  photoUrl,
  onSelect,
}) => {
  return (
    <div
      id={`btn-select-pet-${pet.id}`}
      onClick={() => onSelect(pet.id)}
      className={`w-full p-2.5 rounded-lg text-left transition-all cursor-pointer border flex items-center justify-between gap-3 group ${
        isSelected
          ? 'bg-emerald-50/95 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-500/20'
          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      {/* Foto/Avatar */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-slate-200 shadow-2xs">
          <img
            src={photoUrl}
            alt={`Foto de ${pet.name}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Informações do Paciente */}
        <div className="min-w-0 truncate">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-slate-900 truncate">
              {pet.name}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              #{pet.id}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
            <User size={10} className="text-slate-400 shrink-0" />
            <span className="truncate">Tutor: {pet.owner_name}</span>
          </div>
        </div>
      </div>

      {/* Indicador de Seleção Minimalista */}
      <div className="shrink-0 flex items-center pr-1">
        <div
          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
            isSelected
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
              : 'border-slate-300 bg-white group-hover:border-slate-400'
          }`}
        >
          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </div>
    </div>
  );
};
