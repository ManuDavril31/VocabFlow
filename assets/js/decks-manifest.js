// Catálogo y manifiesto de colecciones / mazos disponibles en VocabFlow
// Permite acceder a colecciones completas sin separar libros

const DECKS_MANIFEST = {
  nation: {
    id: 'nation',
    name: '4000 Essential English Words (Libro Unificado)',
    subtitle: 'Los 6 libros completos unificados en un único libro maestro (3,600 palabras ilustradas)',
    totalCount: 3600,
    file: 'assets/data/decks/nation_all.json',
    levels: [
      { id: 'all', name: 'Libro Unificado (3,600 palabras)', badge: 'Completo', count: 3600, file: 'assets/data/decks/nation_all.json' }
    ],
    defaultLevel: 'all'
  },
  oxford: {
    id: 'oxford',
    name: 'Oxford 5000 Oficial (CEFR)',
    subtitle: '5,948 palabras oficiales de Oxford Dictionaries (A1 a C1) con audio nativo',
    totalCount: 5948,
    file: 'assets/data/decks/oxford_all.json',
    levels: [
      { id: 'all', name: 'Todas (5,948 palabras)', badge: 'Completo', count: 5948, file: 'assets/data/decks/oxford_all.json' },
      { id: 'a1', name: 'Nivel A1', badge: 'Principiante', count: 1081, file: 'assets/data/decks/oxford_a1.json' },
      { id: 'a2', name: 'Nivel A2', badge: 'Básico', count: 990, file: 'assets/data/decks/oxford_a2.json' },
      { id: 'b1', name: 'Nivel B1', badge: 'Intermedio', count: 902, file: 'assets/data/decks/oxford_b1.json' },
      { id: 'b2', name: 'Nivel B2', badge: 'Intermedio Alto', count: 1571, file: 'assets/data/decks/oxford_b2.json' },
      { id: 'c1', name: 'Nivel C1', badge: 'Avanzado', count: 1404, file: 'assets/data/decks/oxford_c1.json' }
    ],
    defaultLevel: 'all'
  }
};

if (typeof window !== 'undefined') {
  window.DECKS_MANIFEST = DECKS_MANIFEST;
}
