// Configuración de la API de ImgBB para subida de imágenes
const IMGBB_CONFIG = {
  primaryApiKey: '233f3cfba00bf0eaf3f6826e8f6f6ba8',
  fallbackKeys: [
    'a05dacbb93267b05d0073a8ac16975b8',
    '7185ca94e7e769ebb549708e62fffb53'
  ],
  uploadUrl: 'https://api.imgbb.com/1/upload'
};

const App = {
  currentView: 'home',
  _selectedWord: null,
  _activeEditingWord: null,

  async init() {
    this.registerServiceWorker();
    this.applyTheme();
    this.bindNavigation();
    this.bindHomeScreen();
    this.bindWordsListScreen();
    this.bindSettingsScreen();
    
    // Iniciar StudyEngine
    StudyEngine.init();

    // Inicializar mazo y niveles
    const hasLoadedDeck = localStorage.getItem(STORAGE_KEYS.ACTIVE_DECK);
    const deck = StorageManager.getActiveDeck();
    const level = StorageManager.getActiveLevel();
    this.renderDeckSelectorUI(deck, level);

    // Cargar mazo activo si es primera visita o está vacío
    const currentWords = StorageManager.getWords();
    if (!hasLoadedDeck || !currentWords || currentWords.length === 0) {
      await StorageManager.loadDeck(deck, level);
    }

    // Cargar vista inicial
    this.navigate('home');
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      navigator.serviceWorker.register('./service-worker.js')
        .catch(err => console.log('SW registration skipped or error:', err));
    }
  },

  applyTheme() {
    const settings = StorageManager.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
  },

  navigate(viewId) {
    this.currentView = viewId;

    // Actualizar secciones de vista
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(sec => sec.classList.remove('active'));

    const targetSection = document.getElementById(`view-${viewId}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Actualizar botones de navegación
    const navButtons = document.querySelectorAll('.nav-item');
    navButtons.forEach(btn => {
      if (btn.getAttribute('data-view') === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Desencadenar lógica específica de la vista
    if (viewId === 'home') {
      this.renderHomeData();
    } else if (viewId === 'study') {
      StudyEngine.startSession();
    } else if (viewId === 'words') {
      this.renderWordsList();
    } else if (viewId === 'progress') {
      this.renderProgressData();
    } else if (viewId === 'settings') {
      this.renderSettingsData();
    }

    // Scroll al tope de forma suave
    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  bindNavigation() {
    const navButtons = document.querySelectorAll('.nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        if (view) this.navigate(view);
      });
    });

    // Botones de retorno o navegación secundaria
    const backButtons = document.querySelectorAll('.btn-nav-back');
    backButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate('home');
      });
    });
  },

  bindHomeScreen() {
    const btnHeroStart = document.getElementById('btnHeroStartStudy');
    if (btnHeroStart) {
      btnHeroStart.addEventListener('click', () => this.navigate('study'));
    }

    const btnQuickQuiz = document.getElementById('btnQuickQuizMode');
    if (btnQuickQuiz) {
      btnQuickQuiz.addEventListener('click', () => {
        StorageManager.saveSettings({ studyMode: 'quiz' });
        this.navigate('study');
      });
    }

    // Selector de Colección / Mazo
    const selectDeck = document.getElementById('selectActiveDeck');
    if (selectDeck) {
      selectDeck.value = StorageManager.getActiveDeck();
      selectDeck.addEventListener('change', async (e) => {
        const newDeck = e.target.value;
        const manifest = (typeof DECKS_MANIFEST !== 'undefined') ? DECKS_MANIFEST[newDeck] : null;
        const defaultLvl = manifest ? manifest.defaultLevel : 'all';
        this.renderDeckSelectorUI(newDeck, defaultLvl);
        await this.switchDeck(newDeck, defaultLvl);
      });
    }

    this.renderDeckSelectorUI();
  },

  renderDeckSelectorUI(activeDeck = null, activeLevel = null) {
    const deck = activeDeck || StorageManager.getActiveDeck();
    const level = activeLevel || StorageManager.getActiveLevel();
    const manifest = (typeof DECKS_MANIFEST !== 'undefined' && DECKS_MANIFEST[deck]) ? DECKS_MANIFEST[deck] : null;
    if (!manifest) return;

    const selectDeck = document.getElementById('selectActiveDeck');
    if (selectDeck && selectDeck.value !== deck) {
      selectDeck.value = deck;
    }

    const subtitle = document.getElementById('homeSubtitle');
    if (subtitle) {
      subtitle.textContent = manifest.subtitle;
    }

    const levelContainer = document.getElementById('deckLevelSelector');
    if (levelContainer) {
      levelContainer.innerHTML = '';
      if (manifest.levels && manifest.levels.length > 1) {
        levelContainer.style.display = 'flex';
        manifest.levels.forEach(lvl => {
          const btn = document.createElement('button');
          const isActive = lvl.id.toLowerCase() === level.toLowerCase();
          btn.className = `pill-level-chip ${isActive ? 'active' : ''}`;
          btn.innerHTML = `<span>${lvl.name}</span> <small style="opacity: 0.75;">(${lvl.count.toLocaleString()})</small>`;
          btn.addEventListener('click', async () => {
            levelContainer.querySelectorAll('.pill-level-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            await this.switchDeck(deck, lvl.id);
          });
          levelContainer.appendChild(btn);
        });
      } else {
        levelContainer.style.display = 'none';
      }
    }

    this.renderCategoryFilterPills(deck);
  },

  async switchDeck(deckId, levelId) {
    const deckName = deckId === 'oxford' ? 'Oxford 5000' : '4000 Essential Words (Libro Unificado)';
    this.showToast(`Cargando ${deckName}...`);
    await StorageManager.loadDeck(deckId, levelId);
    this.renderHomeData();
    if (this.currentView === 'words') {
      this.renderWordsList();
    }
    const count = StorageManager.getWords().length;
    this.showToast(`¡Listo! ${count.toLocaleString()} palabras activas`);
  },

  renderCategoryFilterPills(deckId) {
    const pillsContainer = document.getElementById('wordsCategoryPills');
    if (!pillsContainer) return;
    const manifest = (typeof DECKS_MANIFEST !== 'undefined' && DECKS_MANIFEST[deckId]) ? DECKS_MANIFEST[deckId] : null;
    if (!manifest) return;

    const selectWordsDeck = document.getElementById('selectWordsDeck');
    if (selectWordsDeck && selectWordsDeck.value !== deckId) {
      selectWordsDeck.value = deckId;
    }

    pillsContainer.innerHTML = '';

    if (!manifest.levels || manifest.levels.length <= 1) {
      const chip = document.createElement('button');
      chip.className = 'pill-chip active';
      chip.textContent = `Todas (${(manifest.totalCount || 3600).toLocaleString()} palabras)`;
      pillsContainer.appendChild(chip);
      return;
    }

    const currentLevel = StorageManager.getActiveLevel();
    manifest.levels.forEach((lvl) => {
      const chip = document.createElement('button');
      const isActive = lvl.id.toLowerCase() === currentLevel.toLowerCase();
      chip.className = `pill-chip ${isActive ? 'active' : ''}`;
      chip.setAttribute('data-level-id', lvl.id);
      chip.textContent = `${lvl.name} (${lvl.count.toLocaleString()})`;
      chip.addEventListener('click', async () => {
        pillsContainer.querySelectorAll('.pill-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        await this.switchDeck(deckId, lvl.id);
      });
      pillsContainer.appendChild(chip);
    });
  },

  showToast(msg) {
    let toast = document.getElementById('vocabflowToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vocabflowToast';
      toast.style.cssText = 'position: fixed; bottom: 84px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.95); color: #fff; border: 1px solid var(--accent-primary); padding: 10px 18px; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; box-shadow: var(--shadow-lg); z-index: 1000; pointer-events: none; transition: opacity 0.3s; backdrop-filter: blur(10px);';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      if (toast) toast.style.opacity = '0';
    }, 2500);
  },

  renderHomeData() {
    const stats = StorageManager.getStats();
    const dailyStatus = StorageManager.getDailyStatus();

    // Contador Hero: Palabras pendientes de la dosis de hoy
    const heroNumber = document.getElementById('heroDueCount');
    if (heroNumber) {
      heroNumber.textContent = dailyStatus.isDone ? '10/10' : dailyStatus.remaining;
    }

    const heroStatusText = document.getElementById('heroBatchStatusText');
    if (heroStatusText) {
      if (dailyStatus.isDone) {
        heroStatusText.innerHTML = '🎉 <strong style="color: #10b981;">¡Objetivo cumplido!</strong> Has memorizado tus 10 palabras de hoy.';
      } else {
        heroStatusText.textContent = `${dailyStatus.completed} de ${dailyStatus.target} palabras completadas hoy`;
      }
    }

    const heroProgressBar = document.getElementById('heroProgressBar');
    if (heroProgressBar) {
      const pct = (dailyStatus.completed / dailyStatus.target) * 100;
      heroProgressBar.style.width = `${pct}%`;
    }

    const heroBtnLabel = document.getElementById('heroBtnLabel');
    if (heroBtnLabel) {
      heroBtnLabel.textContent = dailyStatus.isDone ? 'Repasar Palabras de Hoy' : 'Comenzar Dosis de Hoy';
    }

    // Métricas en la cuadrícula
    const streakEl = document.getElementById('homeStreakDays');
    if (streakEl) streakEl.textContent = `${stats.streakDays || 0} 🔥`;

    const todayCountEl = document.getElementById('homeTodayCount');
    if (todayCountEl) todayCountEl.textContent = `${stats.todayCount || 0} palabras`;
  },

  bindWordsListScreen() {
    const searchInput = document.getElementById('wordsSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.renderWordsList(e.target.value.trim().toLowerCase());
      });
    }

    // Selector de colección dentro del Banco de Palabras
    const selectWordsDeck = document.getElementById('selectWordsDeck');
    if (selectWordsDeck) {
      selectWordsDeck.value = StorageManager.getActiveDeck();
      selectWordsDeck.addEventListener('change', async (e) => {
        const newDeck = e.target.value;
        const manifest = (typeof DECKS_MANIFEST !== 'undefined') ? DECKS_MANIFEST[newDeck] : null;
        const defaultLvl = manifest ? manifest.defaultLevel : 'all';
        this.renderDeckSelectorUI(newDeck, defaultLvl);
        await this.switchDeck(newDeck, defaultLvl);
      });
    }

    // Botón para añadir nueva palabra manualmente
    const btnAddNewWord = document.getElementById('btnAddNewWord');
    if (btnAddNewWord) {
      btnAddNewWord.addEventListener('click', () => {
        this.openWordFormModal(null);
      });
    }

    // Modal de detalle
    const modalBackdrop = document.getElementById('wordDetailModal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
          modalBackdrop.classList.remove('active');
        }
      });
    }

    const btnCloseModal = document.getElementById('btnCloseWordModal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => {
        modalBackdrop.classList.remove('active');
      });
    }

    // Botón de editar dentro del modal de detalle
    const btnEditCurrentWord = document.getElementById('btnEditCurrentWord');
    if (btnEditCurrentWord) {
      btnEditCurrentWord.addEventListener('click', () => {
        if (modalBackdrop) modalBackdrop.classList.remove('active');
        if (this._selectedWord) {
          this.openWordFormModal(this._selectedWord);
        }
      });
    }

    // Botón de editar directo en la tarjeta de estudio activa
    const btnEditStudyWord = document.getElementById('btnEditStudyWord');
    if (btnEditStudyWord) {
      btnEditStudyWord.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentWord = StudyEngine.getCurrentWord();
        if (currentWord) {
          this.openWordFormModal(currentWord);
        }
      });
    }

    // Modal de Formulario (Crear / Editar palabra)
    const formModal = document.getElementById('wordFormModal');
    if (formModal) {
      formModal.addEventListener('click', (e) => {
        if (e.target === formModal) {
          formModal.classList.remove('active');
        }
      });
    }

    const btnCloseForm = document.getElementById('btnCloseWordFormModal');
    if (btnCloseForm) {
      btnCloseForm.addEventListener('click', () => {
        if (formModal) formModal.classList.remove('active');
      });
    }

    const btnCancelForm = document.getElementById('btnCancelWordForm');
    if (btnCancelForm) {
      btnCancelForm.addEventListener('click', () => {
        if (formModal) formModal.classList.remove('active');
      });
    }

    const btnSaveForm = document.getElementById('btnSaveWordForm');
    if (btnSaveForm) {
      btnSaveForm.addEventListener('click', () => {
        this.saveWordForm();
      });
    }

    const btnDeleteForm = document.getElementById('btnDeleteWordForm');
    if (btnDeleteForm) {
      btnDeleteForm.addEventListener('click', () => {
        this.deleteWordForm();
      });
    }

    // Eventos del widget de subida de imágenes con ImgBB
    const dropzone = document.getElementById('imgbbUploadDropzone');
    const fileInput = document.getElementById('formImageFileInput');
    const btnTriggerUpload = document.getElementById('btnTriggerImgbbUpload');
    const btnRemoveImage = document.getElementById('btnRemoveFormImage');
    const formImageUrl = document.getElementById('formImageUrl');

    if (btnTriggerUpload && fileInput) {
      btnTriggerUpload.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleImgbbUpload(e.target.files[0]);
        }
      });
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          this.handleImgbbUpload(files[0]);
        }
      });
    }

    if (btnRemoveImage) {
      btnRemoveImage.addEventListener('click', () => {
        if (formImageUrl) formImageUrl.value = '';
        const previewWrap = document.getElementById('formImagePreviewWrap');
        if (previewWrap) previewWrap.style.display = 'none';
        if (fileInput) fileInput.value = '';
      });
    }

    if (formImageUrl) {
      formImageUrl.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const previewWrap = document.getElementById('formImagePreviewWrap');
        const previewImg = document.getElementById('formImagePreview');
        if (val && previewWrap && previewImg) {
          previewImg.src = val;
          previewWrap.style.display = 'flex';
        } else if (previewWrap) {
          previewWrap.style.display = 'none';
        }
      });
    }
  },

  renderWordsList(searchTerm = '') {
    const container = document.getElementById('wordsListContainer');
    if (!container) return;

    let words = StorageManager.getWords();

    // Filtro por término de búsqueda
    if (searchTerm) {
      words = words.filter(w => 
        (w.word && w.word.toLowerCase().includes(searchTerm)) || 
        (w.translation && w.translation.toLowerCase().includes(searchTerm))
      );
    }

    container.innerHTML = '';

    if (words.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
          No se encontraron palabras coincidentes.
        </div>
      `;
      return;
    }

    // Indicador de volumen total
    const countBanner = document.createElement('div');
    countBanner.style.cssText = 'padding: 4px 8px 12px 8px; font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;';
    countBanner.textContent = `Mostrando ${Math.min(words.length, 60)} de ${words.length} palabras`;
    container.appendChild(countBanner);

    const createCard = (w) => {
      const card = document.createElement('div');
      card.className = 'word-row-card';
      const boxClass = `box-${w.box || 1}`;
      const boxNames = ['Nueva', 'Caja 1', 'Caja 2', 'Caja 3', 'Caja 4', 'Dominada'];

      card.innerHTML = `
        <img class="word-list-thumb" src="${w.image || 'assets/icons/icon.svg'}" alt="${w.word}" loading="lazy">
        <div class="word-row-info">
          <div class="word-row-title">
            ${w.word}
            <span class="word-badge-box ${boxClass}">${boxNames[w.box || 1]}</span>
          </div>
          <div class="word-row-sub">${w.translation} &bull; ${w.ipa || ''}</div>
        </div>
        <button class="icon-button" style="width: 40px; height: 40px;" aria-label="Escuchar pronunciación">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </button>
      `;

      // Botón de audio
      const audioBtn = card.querySelector('button');
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speakText(w.word, w);
      });

      // Abrir modal de detalle
      card.addEventListener('click', () => {
        this.openWordDetail(w);
      });

      return card;
    };

    const initialWords = words.slice(0, 60);
    initialWords.forEach(w => container.appendChild(createCard(w)));

    if (words.length > 60) {
      let currentLimit = 60;
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'btn-hero-start';
      loadMoreBtn.style.cssText = 'margin: 16px 0; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-subtle);';
      loadMoreBtn.textContent = `Cargar más palabras (+60)`;
      
      loadMoreBtn.addEventListener('click', () => {
        const nextBatch = words.slice(currentLimit, currentLimit + 60);
        currentLimit += 60;
        nextBatch.forEach(w => container.insertBefore(createCard(w), loadMoreBtn));
        countBanner.textContent = `Mostrando ${Math.min(words.length, currentLimit)} de ${words.length} palabras`;
        if (currentLimit >= words.length) {
          loadMoreBtn.remove();
        }
      });
      container.appendChild(loadMoreBtn);
    }
  },

  openWordDetail(word) {
    const modal = document.getElementById('wordDetailModal');
    if (!modal) return;

    const modalImg = document.getElementById('modalWordImage');
    if (modalImg) {
      modalImg.src = word.image || 'assets/icons/icon.svg';
      modalImg.alt = word.word;
    }

    document.getElementById('modalWordTitle').textContent = word.word;
    document.getElementById('modalWordIpa').textContent = word.ipa || '';
    document.getElementById('modalWordTranslation').textContent = word.translation;
    document.getElementById('modalWordSentence').innerHTML = (word.sentenceFull || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    const transSentenceEl = document.getElementById('modalWordSentenceTrans');
    if (transSentenceEl) transSentenceEl.textContent = word.sentenceTrans || '';

    document.getElementById('modalWordCategory').textContent = `${word.category} &bull; Nivel ${word.level} &bull; Caja Leitner ${word.box || 1}`;

    const btnAudio = document.getElementById('btnModalAudio');
    if (btnAudio) {
      btnAudio.onclick = () => this.speakText(word.word, word);
    }

    this._selectedWord = word;
    modal.classList.add('active');
  },

  openWordFormModal(word = null) {
    const modal = document.getElementById('wordFormModal');
    if (!modal) return;

    const titleEl = document.getElementById('wordFormModalTitle');
    const btnDelete = document.getElementById('btnDeleteWordForm');
    const idInput = document.getElementById('formWordId');
    const wordInput = document.getElementById('formWordText');
    const transInput = document.getElementById('formTranslationText');
    const ipaInput = document.getElementById('formIpaText');
    const catInput = document.getElementById('formCategoryText');
    const sentenceInput = document.getElementById('formSentenceFull');
    const sentenceTransInput = document.getElementById('formSentenceTrans');
    const defInput = document.getElementById('formDefinition');
    const imageInput = document.getElementById('formImageUrl');

    if (word) {
      // Modo Edición
      this._activeEditingWord = word;
      if (titleEl) titleEl.textContent = '✏️ Editar Palabra';
      if (btnDelete) btnDelete.style.display = 'block';

      if (idInput) idInput.value = word.id || '';
      if (wordInput) wordInput.value = word.word || '';
      if (transInput) transInput.value = word.translation || '';
      if (ipaInput) ipaInput.value = word.ipa || '';
      if (catInput) catInput.value = word.category || '';
      if (sentenceInput) sentenceInput.value = (word.sentenceFull || '').replace(/\*\*/g, '');
      if (sentenceTransInput) sentenceTransInput.value = word.sentenceTrans || '';
      if (imageInput) imageInput.value = word.image || '';

      const previewWrap = document.getElementById('formImagePreviewWrap');
      const previewImg = document.getElementById('formImagePreview');
      if (word.image && previewWrap && previewImg) {
        previewImg.src = word.image;
        previewWrap.style.display = 'flex';
      } else if (previewWrap) {
        previewWrap.style.display = 'none';
      }
    } else {
      // Modo Añadir Nueva Palabra
      this._activeEditingWord = null;
      if (titleEl) titleEl.textContent = '➕ Añadir Nueva Palabra';
      if (btnDelete) btnDelete.style.display = 'none';

      if (idInput) idInput.value = '';
      if (wordInput) wordInput.value = '';
      if (transInput) transInput.value = '';
      if (ipaInput) ipaInput.value = '';
      if (catInput) catInput.value = 'Mi Vocabulario';
      if (sentenceInput) sentenceInput.value = '';
      if (sentenceTransInput) sentenceTransInput.value = '';
      if (defInput) defInput.value = '';
      if (imageInput) imageInput.value = '';

      const previewWrap = document.getElementById('formImagePreviewWrap');
      if (previewWrap) previewWrap.style.display = 'none';
    }

    const fileInput = document.getElementById('formImageFileInput');
    if (fileInput) fileInput.value = '';

    const loadingEl = document.getElementById('imgbbUploadLoading');
    if (loadingEl) loadingEl.style.display = 'none';

    const dropContent = document.getElementById('imgbbDropContent');
    if (dropContent) dropContent.style.display = 'flex';

    modal.classList.add('active');
    setTimeout(() => {
      if (wordInput) wordInput.focus();
    }, 150);
  },

  saveWordForm() {
    const idInput = document.getElementById('formWordId');
    const wordInput = document.getElementById('formWordText');
    const transInput = document.getElementById('formTranslationText');
    const ipaInput = document.getElementById('formIpaText');
    const catInput = document.getElementById('formCategoryText');
    const sentenceInput = document.getElementById('formSentenceFull');
    const sentenceTransInput = document.getElementById('formSentenceTrans');
    const defInput = document.getElementById('formDefinition');
    const imageInput = document.getElementById('formImageUrl');

    const wordText = wordInput ? wordInput.value.trim() : '';
    const transText = transInput ? transInput.value.trim() : '';
    const sentenceText = sentenceInput ? sentenceInput.value.trim() : '';
    const sentenceTransText = sentenceTransInput ? sentenceTransInput.value.trim() : '';

    if (!wordText || !transText) {
      alert('Por favor completa al menos la palabra en inglés y su traducción al español.');
      return;
    }

    const wordData = {
      word: wordText,
      translation: transText,
      ipa: ipaInput ? ipaInput.value.trim() : '',
      category: catInput ? catInput.value.trim() : 'Mi Vocabulario',
      sentenceFull: sentenceText || `I practice using the word **${wordText}**.`,
      sentenceTrans: sentenceTransText || `Practico el uso de la palabra ${transText}.`,
      definition: defInput ? defInput.value.trim() : '',
      image: imageInput ? imageInput.value.trim() : ''
    };

    const modal = document.getElementById('wordFormModal');
    const wordId = idInput ? idInput.value : '';

    if (wordId) {
      // Actualizar existente
      const updated = StorageManager.updateWord(wordId, wordData);
      if (this._selectedWord && this._selectedWord.id === wordId) {
        this._selectedWord = updated;
      }
      if (this.currentView === 'study') {
        StudyEngine.updateCurrentWord(updated);
      }
      this.showToast(`¡Palabra "${wordText}" actualizada! 💾`);
    } else {
      // Crear nueva palabra
      const created = StorageManager.addWord(wordData);
      this.showToast(`¡Palabra "${wordText}" añadida a tu colección! 🎉`);
    }

    if (modal) modal.classList.remove('active');
    this.renderWordsList();
    this.renderHomeData();
  },

  deleteWordForm() {
    const idInput = document.getElementById('formWordId');
    const wordInput = document.getElementById('formWordText');
    const wordId = idInput ? idInput.value : '';
    const wordText = wordInput ? wordInput.value : '';

    if (!wordId) return;

    if (confirm(`¿Estás seguro de que deseas eliminar "${wordText}" de tu vocabulario?`)) {
      StorageManager.deleteWord(wordId);
      const modal = document.getElementById('wordFormModal');
      if (modal) modal.classList.remove('active');

      const detailModal = document.getElementById('wordDetailModal');
      if (detailModal) detailModal.classList.remove('active');

      if (this.currentView === 'study') {
        StudyEngine.startSession();
      }

      this.renderWordsList();
      this.renderHomeData();
      this.showToast(`Palabra "${wordText}" eliminada. 🗑️`);
    }
  },

  async handleImgbbUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, GIF, WebP).');
      return;
    }

    const dropContent = document.getElementById('imgbbDropContent');
    const loading = document.getElementById('imgbbUploadLoading');
    const previewWrap = document.getElementById('formImagePreviewWrap');
    const previewImg = document.getElementById('formImagePreview');
    const urlInput = document.getElementById('formImageUrl');

    if (dropContent) dropContent.style.display = 'none';
    if (loading) loading.style.display = 'flex';

    try {
      this.showToast('Subiendo imagen a ImgBB...');
      const uploadedUrl = await this.uploadToImgBB(file);
      if (urlInput) urlInput.value = uploadedUrl;
      if (previewImg) previewImg.src = uploadedUrl;
      if (previewWrap) previewWrap.style.display = 'flex';
      this.showToast('¡Imagen subida a ImgBB con éxito! 📸');
    } catch (err) {
      console.error('Error ImgBB:', err);
      alert(`No se pudo subir la imagen a ImgBB: ${err.message || 'Error de conexión'}. Puedes ingresar un enlace de imagen directamente.`);
    } finally {
      if (loading) loading.style.display = 'none';
      if (dropContent) dropContent.style.display = 'flex';
    }
  },

  async uploadToImgBB(file) {
    const keys = [IMGBB_CONFIG.primaryApiKey, ...IMGBB_CONFIG.fallbackKeys];
    let lastError = null;

    for (const key of keys) {
      try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`${IMGBB_CONFIG.uploadUrl}?key=${key}`, {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (data && data.success && data.data) {
          return data.data.display_url || data.data.url;
        } else if (data && data.error && data.error.message) {
          lastError = data.error.message;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    throw new Error(lastError || 'Error al comunicarse con la API de ImgBB');
  },

  speakText(text, wordObj = null) {
    // Si la palabra tiene audio oficial MP3 (ej. Oxford)
    if (wordObj && wordObj.audio && wordObj.audio.startsWith('http')) {
      try {
        if (this._currentAudio) {
          this._currentAudio.pause();
          this._currentAudio.currentTime = 0;
        }
        this._currentAudio = new Audio(wordObj.audio);
        const p = this._currentAudio.play();
        if (p !== undefined) {
          p.catch(() => this._synthSpeak(text));
        }
        return;
      } catch (e) {}
    }

    this._synthSpeak(text);
  },

  _synthSpeak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    const settings = StorageManager.getSettings();
    utterance.rate = settings.speechRate || 0.9;
    
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  },

  renderProgressData() {
    const words = StorageManager.getWords();
    const stats = StorageManager.getStats();

    // Racha
    const streakEl = document.getElementById('progressStreakDays');
    if (streakEl) streakEl.textContent = `${stats.streakDays || 0} días seguidos`;

    // Total repasos
    const totalReviewsEl = document.getElementById('progressTotalReviews');
    if (totalReviewsEl) totalReviewsEl.textContent = `${stats.totalReviews || 0}`;

    // Distribución por cajas Leitner SRS
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    words.forEach(w => {
      const b = w.box || 1;
      counts[b] = (counts[b] || 0) + 1;
    });

    const total = words.length || 1;
    
    // Porcentaje de retención (Cajas 3, 4, 5)
    const masteredCount = counts[3] + counts[4] + counts[5];
    const retentionRate = Math.round((masteredCount / total) * 100);
    const retentionEl = document.getElementById('progressRetentionRate');
    if (retentionEl) retentionEl.textContent = `${retentionRate}%`;

    // Actualizar barras Leitner
    const boxes = [
      { id: 'srsBar1', countId: 'srsCount1', count: counts[1], color: '#f43f5e' },
      { id: 'srsBar2', countId: 'srsCount2', count: counts[2], color: '#eab308' },
      { id: 'srsBar3', countId: 'srsCount3', count: counts[3], color: '#3b82f6' },
      { id: 'srsBar4', countId: 'srsCount4', count: counts[4], color: '#a855f7' },
      { id: 'srsBar5', countId: 'srsCount5', count: counts[5], color: '#10b981' }
    ];

    boxes.forEach(b => {
      const fillEl = document.getElementById(b.id);
      const countEl = document.getElementById(b.countId);
      if (countEl) countEl.textContent = `${b.count} (${Math.round((b.count / total) * 100)}%)`;
      if (fillEl) {
        fillEl.style.width = `${(b.count / total) * 100}%`;
        fillEl.style.backgroundColor = b.color;
      }
    });
  },

  bindSettingsScreen() {
    const toggleTheme = document.getElementById('settingsToggleTheme');
    if (toggleTheme) {
      toggleTheme.addEventListener('change', (e) => {
        const theme = e.target.checked ? 'dark' : 'light';
        StorageManager.saveSettings({ theme });
        this.applyTheme();
      });
    }

    const toggleAutoAudio = document.getElementById('settingsToggleAudio');
    if (toggleAutoAudio) {
      toggleAutoAudio.addEventListener('change', (e) => {
        StorageManager.saveSettings({ autoPlayAudio: e.target.checked });
      });
    }

    const toggleGestures = document.getElementById('settingsToggleGestures');
    if (toggleGestures) {
      toggleGestures.addEventListener('change', (e) => {
        StorageManager.saveSettings({ gesturesEnabled: e.target.checked });
      });
    }

    const selectSpeed = document.getElementById('settingsSelectSpeed');
    if (selectSpeed) {
      selectSpeed.addEventListener('change', (e) => {
        StorageManager.saveSettings({ speechRate: parseFloat(e.target.value) });
      });
    }

    const selectStudyMode = document.getElementById('settingsStudyMode');
    if (selectStudyMode) {
      selectStudyMode.addEventListener('change', (e) => {
        StorageManager.saveSettings({ studyMode: e.target.value });
      });
    }

    const btnReset = document.getElementById('btnResetData');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('¿Estás seguro de reiniciar todo el progreso? Volverás a empezar las tarjetas desde cero.')) {
          StorageManager.resetProgress();
          alert('Progreso reiniciado correctamente.');
          this.navigate('home');
        }
      });
    }
  },

  renderSettingsData() {
    const settings = StorageManager.getSettings();
    const toggleTheme = document.getElementById('settingsToggleTheme');
    if (toggleTheme) toggleTheme.checked = (settings.theme !== 'light');

    const toggleAudio = document.getElementById('settingsToggleAudio');
    if (toggleAudio) toggleAudio.checked = !!settings.autoPlayAudio;

    const toggleGestures = document.getElementById('settingsToggleGestures');
    if (toggleGestures) toggleGestures.checked = !!settings.gesturesEnabled;

    const selectSpeed = document.getElementById('settingsSelectSpeed');
    if (selectSpeed) selectSpeed.value = settings.speechRate || 0.9;

    const selectMode = document.getElementById('settingsStudyMode');
    if (selectMode) selectMode.value = settings.studyMode || 'flashcards';
  }
};

// Iniciar aplicación una vez cargado el DOM
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
