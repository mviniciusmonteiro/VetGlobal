import React, { useState, useMemo } from 'react';
import type { Pet } from '../types';
import { PetCreateForm } from './PetCreateForm';
import { PetListItem } from './PetListItem';
import {
  PawPrint,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface PetSectionProps {
  pets: Pet[];
  selectedPetId: number | null;
  onSelectPet: (petId: number) => void;
  onPetCreated: (newPet: Pet) => void;
}

const ITEMS_PER_PAGE = 4;

const PET_AVATARS = [
  '/gary-bendig-6GMq7AGxNbE-unsplash.jpg',
  '/hoyoun-lee-oDsLyb_H92k-unsplash.jpg',
  '/ricky-kharawala-adK3Vu70DEQ-unsplash.jpg',
];

export const PetSection: React.FC<PetSectionProps> = ({
  pets,
  selectedPetId,
  onSelectPet,
  onPetCreated,
}) => {
  const [showNewForm, setShowNewForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPets = useMemo(() => {
    if (!searchTerm.trim()) return pets;
    const term = searchTerm.toLowerCase();
    return pets.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.owner_name.toLowerCase().includes(term) ||
        p.id.toString().includes(term)
    );
  }, [pets, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPets.length / ITEMS_PER_PAGE));
  const paginatedPets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPets, currentPage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePetCreated = (newPet: Pet) => {
    onPetCreated(newPet);
    onSelectPet(newPet.id);
    setShowNewForm(false);
    setCurrentPage(1);
  };

  const getPetPhotoUrl = (petId: number) => {
    return PET_AVATARS[Math.abs(petId) % PET_AVATARS.length];
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col relative">
      {/* Cabeçalho do Diretório */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-2xs">
            <PawPrint size={17} />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Diretório de Pacientes
            </h2>
            <p className="text-[11px] text-slate-500">
              {pets.length} {pets.length === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}
            </p>
          </div>
        </div>

        <button
          id="btn-toggle-new-pet"
          type="button"
          onClick={() => setShowNewForm(!showNewForm)}
          className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-100/80 text-emerald-900 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
        >
          <Plus size={13} />
          {showNewForm ? 'Cancelar' : 'Cadastrar'}
        </button>
      </div>

      {/* Formulário Modular de Novo Paciente */}
      {showNewForm && <PetCreateForm onSuccess={handlePetCreated} />}

      {/* Barra de Pesquisa */}
      {pets.length > 0 && (
        <div className="relative mb-2.5">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por paciente, tutor ou prontuário..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20 transition-all"
          />
        </div>
      )}

      {/* Lista Modular de Pacientes */}
      <div className="space-y-1.5 flex-1 min-h-[180px]">
        {filteredPets.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
            {pets.length === 0
              ? 'Nenhum paciente cadastrado no banco de dados.'
              : 'Nenhum paciente encontrado para esta busca.'}
          </div>
        ) : (
          paginatedPets.map((p) => (
            <PetListItem
              key={p.id}
              pet={p}
              isSelected={selectedPetId === p.id}
              photoUrl={getPetPhotoUrl(p.id)}
              onSelect={onSelectPet}
            />
          ))
        )}
      </div>

      {/* Paginação */}
      {filteredPets.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs text-slate-500">
          <span className="text-[11px]">
            Página <strong className="text-slate-800">{currentPage}</strong> de {totalPages} ({filteredPets.length} registros)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              title="Página Anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              title="Próxima Página"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}


    </div>
  );
};
