// Gestión de almacenamiento local (localStorage), Lote Diario (10 palabras), Colección Unificada y SRS Leitner

const STORAGE_KEYS = {
  WORDS_DATA: 'vocabflow_words_unified_v4',
  SETTINGS: 'vocabflow_settings_unified_v4',
  STATS: 'vocabflow_stats_unified_v4',
  DAILY_BATCH: 'vocabflow_daily_batch_unified_v4',
  REVIEWS_MAP: 'vocabflow_reviews_map_v1',
  ACTIVE_DECK: 'vocabflow_active_deck_v1',
  ACTIVE_LEVEL: 'vocabflow_active_level_v1'
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  speechRate: 0.9,
  autoPlayAudio: true,
  gesturesEnabled: true,
  dailyGoal: 10,
  studyMode: 'flashcards',
  activeDeck: 'nation',
  activeLevel: 'all'
};

const StorageManager = {
  getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(newSettings) {
    const current = this.getSettings();
    const merged = { ...current, ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    return merged;
  },

  // Mapa global de revisiones (preserva cajas Leitner y rachas entre cambios de mazo)
  getReviewsMap() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.REVIEWS_MAP);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  },

  saveReviewsMap(map) {
    try {
      localStorage.setItem(STORAGE_KEYS.REVIEWS_MAP, JSON.stringify(map));
    } catch (e) {}
  },

  getActiveDeck() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_DECK) || 'nation';
  },

  getActiveLevel() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_LEVEL) || 'all';
  },

  setActiveDeck(deckId, levelId = 'all') {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DECK, deckId);
    if (levelId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_LEVEL, levelId);
    }
  },

  async loadDeck(deckId = 'nation', levelId = 'all') {
    this.setActiveDeck(deckId, levelId);
    const manifest = (typeof DECKS_MANIFEST !== 'undefined' && DECKS_MANIFEST[deckId]) ? DECKS_MANIFEST[deckId] : null;

    if (!manifest) {
      return this.getWords();
    }

    let filesToFetch = [];
    if (levelId === 'all') {
      if (manifest.file) {
        filesToFetch = [manifest.file];
      } else {
        filesToFetch = manifest.levels.filter(l => l.file).map(l => l.file);
      }
    } else {
      const target = manifest.levels.find(l => l.id.toLowerCase() === levelId.toLowerCase());
      if (target && target.file) {
        filesToFetch = [target.file];
      } else {
        filesToFetch = [manifest.file || manifest.levels.find(l => l.file)?.file || manifest.levels[0].file];
      }
    }

    try {
      const responses = await Promise.all(
        filesToFetch.map(async f => {
          let url = f;
          if (!f.startsWith('http') && !f.startsWith('/')) {
            let path = window.location.pathname;
            if (!path.endsWith('/')) {
              path = path.substring(0, path.lastIndexOf('/') + 1);
            }
            url = `${path}${f}`;
          }
          const res = await fetch(`${url}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${url}`);
          return await res.json();
        })
      );
      const combined = responses.flat();
      const reviewsMap = this.getReviewsMap();

      const mergedWords = combined.map(w => {
        const saved = reviewsMap[w.id];
        return {
          ...this._initWordProgress(w),
          ...(saved || {})
        };
      });

      this.saveWords(mergedWords);
      localStorage.removeItem(STORAGE_KEYS.DAILY_BATCH); // Renovar dosis diaria para este mazo
      return mergedWords;
    } catch (err) {
      console.warn('Carga asíncrona falló, usando palabras locales:', err);
      return this.getWords();
    }
  },

  getWords() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WORDS_DATA);
      const storedList = stored ? JSON.parse(stored) : [];

      if (Array.isArray(storedList) && storedList.length > 0) {
        const reviewsMap = this.getReviewsMap();
        return storedList.map(w => {
          const saved = reviewsMap[w.id];
          return {
            ...this._initWordProgress(w),
            ...(saved || {})
          };
        });
      }

      // Fallback a INITIAL_WORDS si aún no hay datos almacenados
      if (typeof INITIAL_WORDS !== 'undefined' && Array.isArray(INITIAL_WORDS)) {
        const reviewsMap = this.getReviewsMap();
        const initList = INITIAL_WORDS.map(initW => {
          const saved = reviewsMap[initW.id];
          return {
            ...this._initWordProgress(initW),
            ...(saved || {})
          };
        });
        this.saveWords(initList);
        return initList;
      }

      return [];
    } catch (e) {
      return (typeof INITIAL_WORDS !== 'undefined' && Array.isArray(INITIAL_WORDS)) 
        ? INITIAL_WORDS.map(w => this._initWordProgress(w)) 
        : [];
    }
  },

  _initWordProgress(word) {
    return {
      ...word,
      box: word.box || 1, // 1: Nueva/Difícil, 2: Aprendiendo, 3: Repaso regular, 4: Avanzada, 5: Dominada
      reviewsCount: word.reviewsCount || 0,
      streak: word.streak || 0,
      lastReviewed: word.lastReviewed || null,
      nextReview: word.nextReview || 0 // timestamp
    };
  },

  saveWords(words) {
    try {
      localStorage.setItem(STORAGE_KEYS.WORDS_DATA, JSON.stringify(words));
    } catch (e) {
      console.error('Error al guardar palabras:', e);
    }
  },

  getWordById(wordId) {
    const words = this.getWords();
    return words.find(w => w.id === wordId) || null;
  },

  addWord(newWordData) {
    const words = this.getWords();
    const cleanWord = (newWordData.word || '').trim();
    if (!cleanWord) return null;

    const id = newWordData.id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const sentenceFull = (newWordData.sentenceFull || '').trim();
    
    // Generar máscara automática si no existe
    let sentenceMasked = newWordData.sentenceMasked || '';
    if (!sentenceMasked && sentenceFull) {
      const reg = new RegExp(`\\b${cleanWord}\\b`, 'gi');
      sentenceMasked = sentenceFull.replace(reg, '___');
      if (!sentenceMasked.includes('___')) {
        sentenceMasked = sentenceFull;
      }
    }

    const wordObj = {
      id,
      word: cleanWord,
      translation: (newWordData.translation || '').trim(),
      ipa: (newWordData.ipa || '').trim(),
      definition: (newWordData.definition || '').trim(),
      sentenceFull,
      sentenceMasked,
      sentenceTrans: (newWordData.sentenceTrans || '').trim(),
      image: (newWordData.image || '').trim() || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&auto=format&fit=crop&q=80',
      mnemonic: (newWordData.mnemonic || '').trim(),
      category: (newWordData.category || 'Personalizada').trim(),
      pos: (newWordData.pos || 'v.').trim(),
      options: newWordData.options || [
        (newWordData.translation || cleanWord),
        'cambiar',
        'olvidar',
        'ignorar'
      ],
      ...this._initWordProgress({})
    };

    // Añadir al principio para que sea visible de inmediato
    words.unshift(wordObj);
    this.saveWords(words);

    return wordObj;
  },

  updateWord(wordId, updatedFields) {
    const words = this.getWords();
    const idx = words.findIndex(w => w.id === wordId);
    if (idx === -1) return null;

    const current = words[idx];
    const merged = { ...current, ...updatedFields };

    if (updatedFields.sentenceFull && (!updatedFields.sentenceMasked || updatedFields.sentenceMasked === current.sentenceMasked)) {
      const cleanWord = (merged.word || '').trim();
      const reg = new RegExp(`\\b${cleanWord}\\b`, 'gi');
      merged.sentenceMasked = merged.sentenceFull.replace(reg, '___');
    }

    words[idx] = merged;
    this.saveWords(words);

    // Actualizar en mapa de revisiones si aplica
    const reviewsMap = this.getReviewsMap();
    if (reviewsMap[wordId]) {
      reviewsMap[wordId] = {
        ...reviewsMap[wordId],
        box: merged.box,
        streak: merged.streak
      };
      this.saveReviewsMap(reviewsMap);
    }

    return merged;
  },

  deleteWord(wordId) {
    let words = this.getWords();
    const prevLen = words.length;
    words = words.filter(w => w.id !== wordId);
    if (words.length !== prevLen) {
      this.saveWords(words);

      // Eliminar también del lote diario si estaba en curso
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.DAILY_BATCH);
        if (stored) {
          const batch = JSON.parse(stored);
          if (batch && Array.isArray(batch.wordIds)) {
            batch.wordIds = batch.wordIds.filter(id => id !== wordId);
            batch.completedIds = (batch.completedIds || []).filter(id => id !== wordId);
            localStorage.setItem(STORAGE_KEYS.DAILY_BATCH, JSON.stringify(batch));
          }
        }
      } catch (e) {}

      return true;
    }
    return false;
  },

  // ==========================================
  // MOTOR DE DOSIS DIARIA (10 PALABRAS CADA DÍA)
  // ==========================================
  getDailyBatch(targetCount = 10) {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = Date.now();
    let batchData = null;

    const allWords = this.getWords();
    const wordsMap = new Map(allWords.map(w => [w.id, w]));

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DAILY_BATCH);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.date === todayStr && Array.isArray(parsed.wordIds) && parsed.wordIds.length === targetCount) {
          const allExist = parsed.wordIds.every(id => wordsMap.has(id));
          if (allExist) {
            batchData = parsed;
          }
        }
      }
    } catch (e) {
      batchData = null;
    }

    if (!batchData) {
      // 1. Palabras que están listas para repasar según el algoritmo Leitner
      const dueWords = allWords.filter(w => w.reviewsCount > 0 && (!w.nextReview || w.nextReview <= now));
      
      // 2. Palabras nuevas que nunca han sido estudiadas
      const newWords = allWords.filter(w => (w.reviewsCount || 0) === 0);

      // 3. Palabras de refuerzo (las de menor caja Leitner o menor racha)
      const reinforcementWords = allWords.filter(w => !dueWords.includes(w) && !newWords.includes(w))
        .sort((a, b) => (a.box || 1) - (b.box || 1) || (a.streak || 0) - (b.streak || 0));

      const selectedIds = [];

      // Primero: palabras vencidas de repaso
      for (const w of dueWords) {
        if (selectedIds.length < targetCount && !selectedIds.includes(w.id)) {
          selectedIds.push(w.id);
        }
      }

      // Segundo: complementar con palabras nuevas del día
      for (const w of newWords) {
        if (selectedIds.length < targetCount && !selectedIds.includes(w.id)) {
          selectedIds.push(w.id);
        }
      }

      // Tercero: si aún no alcanza 10, completar con palabras de refuerzo
      for (const w of reinforcementWords) {
        if (selectedIds.length < targetCount && !selectedIds.includes(w.id)) {
          selectedIds.push(w.id);
        }
      }

      // Garantizar que siempre haya palabras si la colección es menor o igual
      for (const w of allWords) {
        if (selectedIds.length < targetCount && !selectedIds.includes(w.id)) {
          selectedIds.push(w.id);
        }
      }

      batchData = {
        date: todayStr,
        wordIds: selectedIds,
        completedIds: [],
        isCompleted: false
      };
      localStorage.setItem(STORAGE_KEYS.DAILY_BATCH, JSON.stringify(batchData));
    }

    return {
      date: batchData.date,
      wordIds: batchData.wordIds,
      completedIds: batchData.completedIds || [],
      isCompleted: (batchData.completedIds || []).length >= batchData.wordIds.length,
      words: batchData.wordIds.map(id => wordsMap.get(id)).filter(Boolean)
    };
  },

  recordDailyWordComplete(wordId) {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DAILY_BATCH);
      if (stored) {
        const batchData = JSON.parse(stored);
        if (batchData && batchData.date === todayStr) {
          batchData.completedIds = batchData.completedIds || [];
          if (!batchData.completedIds.includes(wordId)) {
            batchData.completedIds.push(wordId);
          }
          if (batchData.completedIds.length >= batchData.wordIds.length) {
            batchData.isCompleted = true;
          }
          localStorage.setItem(STORAGE_KEYS.DAILY_BATCH, JSON.stringify(batchData));
          return batchData;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  },

  getDailyStatus() {
    const todayStr = new Date().toISOString().split('T')[0];
    const target = 10;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DAILY_BATCH);
      if (stored) {
        const batch = JSON.parse(stored);
        if (batch && batch.date === todayStr) {
          const completedCount = (batch.completedIds || []).length;
          return {
            date: todayStr,
            target,
            completed: Math.min(completedCount, target),
            remaining: Math.max(0, target - completedCount),
            isDone: completedCount >= target
          };
        }
      }
    } catch (e) {}

    return {
      date: todayStr,
      target,
      completed: 0,
      remaining: target,
      isDone: false
    };
  },

  // ==========================================
  // ALGORITMO SRS LEITNER DE REPETICIÓN ESPACIADA
  // ==========================================
  updateWordRating(wordId, rating) {
    // rating: 'hard' (Difícil), 'good' (Bien), 'easy' (Fácil)
    const words = this.getWords();
    const index = words.findIndex(w => w.id === wordId);
    if (index === -1) return null;

    const word = words[index];
    const now = Date.now();
    word.reviewsCount = (word.reviewsCount || 0) + 1;
    word.lastReviewed = now;

    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;

    if (rating === 'hard') {
      word.box = 1;
      word.streak = 0;
      // Repetir en 10 minutos (curva del olvido inmediata)
      word.nextReview = now + (10 * 60 * 1000);
    } else if (rating === 'good') {
      word.box = Math.min((word.box || 1) + 1, 5);
      word.streak = (word.streak || 0) + 1;
      // Intervalos Leitner crecientes: Caja 1: 10m, Caja 2: 1d, Caja 3: 3d, Caja 4: 7d, Caja 5: 14d
      const intervals = [10 * 60 * 1000, ONE_DAY, 3 * ONE_DAY, 7 * ONE_DAY, 14 * ONE_DAY, 30 * ONE_DAY];
      word.nextReview = now + (intervals[word.box] || ONE_DAY);
    } else if (rating === 'easy') {
      word.box = Math.min((word.box || 1) + 2, 5);
      word.streak = (word.streak || 0) + 2;
      // Salto rápido en intervalo: Caja 2: 3d, Caja 3: 7d, Caja 4: 14d, Caja 5: 30d
      const intervals = [ONE_DAY, 3 * ONE_DAY, 7 * ONE_DAY, 14 * ONE_DAY, 30 * ONE_DAY, 60 * ONE_DAY];
      word.nextReview = now + (intervals[word.box] || (3 * ONE_DAY));
    }

    words[index] = word;
    this.saveWords(words);
    
    // Registrar en mapa persistente de repasos para no perder progreso entre mazos
    const reviewsMap = this.getReviewsMap();
    reviewsMap[word.id] = {
      box: word.box,
      reviewsCount: word.reviewsCount,
      streak: word.streak,
      lastReviewed: word.lastReviewed,
      nextReview: word.nextReview
    };
    this.saveReviewsMap(reviewsMap);

    // Registrar avance del lote diario
    this.recordDailyWordComplete(wordId);
    this.recordDailyReview();

    return word;
  },

  getStats() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.STATS);
      const stats = stored ? JSON.parse(stored) : {
        streakDays: 0,
        lastActiveDate: null,
        todayCount: 0,
        totalReviews: 0,
        history: {}
      };

      // Comprobar racha diaria
      const todayStr = new Date().toISOString().split('T')[0];
      if (stats.lastActiveDate !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (stats.lastActiveDate === yesterdayStr) {
          // Mantiene racha
        } else if (stats.lastActiveDate && stats.lastActiveDate < yesterdayStr) {
          // Racha perdida
          stats.streakDays = 0;
        }
        stats.todayCount = 0;
      }
      return stats;
    } catch (e) {
      return { streakDays: 0, lastActiveDate: null, todayCount: 0, totalReviews: 0, history: {} };
    }
  },

  recordDailyReview() {
    const stats = this.getStats();
    const todayStr = new Date().toISOString().split('T')[0];

    if (stats.lastActiveDate !== todayStr) {
      stats.streakDays = (stats.streakDays || 0) + 1;
      stats.lastActiveDate = todayStr;
      stats.todayCount = 1;
    } else {
      stats.todayCount = (stats.todayCount || 0) + 1;
    }

    stats.totalReviews = (stats.totalReviews || 0) + 1;
    stats.history = stats.history || {};
    stats.history[todayStr] = (stats.history[todayStr] || 0) + 1;

    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    return stats;
  },

  resetProgress() {
    localStorage.removeItem(STORAGE_KEYS.WORDS_DATA);
    localStorage.removeItem(STORAGE_KEYS.STATS);
    localStorage.removeItem(STORAGE_KEYS.DAILY_BATCH);
    this.saveWords(INITIAL_WORDS);
  }
};

if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
