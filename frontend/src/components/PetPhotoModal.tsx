import React from 'react';
import type { Pet } from '../types';
import { PawPrint, Check, X } from 'lucide-react';

interface PetPhotoModalProps {
  pet: Pet | null;
  photoUrl: string;
  onClose: () => void;
  onSelectPet: (petId: number) => void;
}

export const PetPhotoModal: React.FC<PetPhotoModalProps> = ({
  pet,
  photoUrl,
  onClose,
  onSelectPet,
}) => {
  if (!pet) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl p-5 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-all"
          title="Fechar visualização"
        >
          <X size={15} />
        </button>

        <div className="text-xs uppercase font-bold text-emerald-700 tracking-wider mb-2 flex items-center gap-1.5">
          <PawPrint size={13} /> Registro Fotográfico do Paciente
        </div>

        <div className="w-full h-64 rounded-xl overflow-hidden mb-3.5 border border-slate-200 bg-slate-100 shadow-inner">
          <img
            src={photoUrl}
            alt={pet.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">{pet.name}</h3>
            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Prontuário #{pet.id}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Tutor Responsável:{' '}
            <span className="font-semibold text-slate-700">{pet.owner_name}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectPet(pet.id);
            onClose();
          }}
          className="w-full mt-4 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
        >
          <Check size={14} />
          Selecionar Este Paciente para Exame
        </button>
      </div>
    </div>
  );
};
