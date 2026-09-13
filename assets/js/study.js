// Motor de estudio ergonómico, Dosis Diaria (10 palabras), Dual Coding (Imagen + Frase), SRS y Gestos Táctiles

const StudyEngine = {
  queue: [],
  currentIndex: 0,
  isRevealed: false,
  isTouchDragging: false,
  touchStartX: 0,
  touchStartY: 0,
  deltaX: 0,
  deltaY: 0,
  cardElement: null,

  init() {
    this.cardElement = document.getElementById('studyCard');
    this.bindEvents();
    this.bindGestures();
  },

  startSession(mode = null) {
    // Obtener la dosis de 10 palabras del día
    const batch = StorageManager.getDailyBatch(10);
    this.queue = batch.words && batch.words.length > 0 ? [...batch.words] : StorageManager.getWords().slice(0, 10);
    
    // Barajar aleatoriamente para dinamismo
    this.queue.sort(() => Math.random() - 0.5);

    this.currentIndex = 0;
    this.isRevealed = false;
    this.renderCurrentCard();
  },

  getCurrentWord() {
    if (!this.queue || this.queue.length === 0) return null;
    return this.queue[this.currentIndex];
  },

  updateCurrentWord(updatedWord) {
    if (!this.queue || !this.queue[this.currentIndex]) return;
    this.queue[this.currentIndex] = { ...this.queue[this.currentIndex], ...updatedWord };
    this.renderCurrentCard();
    if (this.isRevealed) {
      this.revealAnswer();
    }
  },

  renderCurrentCard() {
    const word = this.getCurrentWord();
    const container = document.getElementById('studyViewContent');
    const completionView = document.getElementById('studyCompletionView');

    if (!word) {
      // Mostrar pantalla de felicitaciones al completar las 10 palabras
      if (container) container.style.display = 'none';
      if (completionView) {
        completionView.style.display = 'flex';
        
        // Actualizar datos de racha y estado diario
        const stats = StorageManager.getStats();
        const streakEl = document.getElementById('completionStreakBadge');
        if (streakEl) {
          streakEl.textContent = `Racha activa: ${stats.streakDays || 1} días 🔥`;
        }
      }
      return;
    }

    if (container) container.style.display = 'flex';
    if (completionView) completionView.style.display = 'none';

    this.isRevealed = false;

    // Actualizar contador y barra de progreso superior
    const remaining = this.queue.length - this.currentIndex;
    const counterEl = document.getElementById('studyRemainingCounter');
    if (counterEl) counterEl.textContent = `${remaining} restantes`;

    const progressPercent = ((this.currentIndex) / this.queue.length) * 100;
    const progressBar = document.getElementById('studyProgressBar');
    if (progressBar) progressBar.style.width = `${progressPercent}%`;

    // 1. IMAGEN MNEMOTÉCNICA (Dual Coding Theory)
    const cardImg = document.getElementById('cardImage');
    if (cardImg) {
      cardImg.src = word.image || 'assets/icons/icon.svg';
      cardImg.alt = `Ilustración para ${word.word}`;
    }

    // 2. PALABRA, PARTE DE LA ORACIÓN Y FONÉTICA IPA
    const wordEl = document.getElementById('cardWordDominance');
    if (wordEl) wordEl.textContent = word.word;

    const posEl = document.getElementById('cardPosBadge');
    if (posEl) {
      posEl.textContent = word.pos || '';
      posEl.style.display = word.pos ? 'inline-block' : 'none';
    }
    
    const ipaEl = document.getElementById('cardIpaText');
    if (ipaEl) ipaEl.textContent = word.ipa || '';

    // 2.1 DEFINICIÓN PEDAGÓGICA EN INGLÉS (Inmersión Anki)
    const defEl = document.getElementById('cardDefinitionText');
    const defBox = document.getElementById('cardDefinitionBox');
    if (defEl && defBox) {
      if (word.definition) {
        defEl.textContent = word.definition;
        defBox.style.display = 'block';
      } else {
        defBox.style.display = 'none';
      }
    }

    // 3. FRASE CONTEXTUAL CON MÁSCARA (Active Recall / Cloze Test)
    const maskedSentenceEl = document.getElementById('cardSentenceMasked');
    if (maskedSentenceEl) {
      const sentenceHtml = (word.sentenceMasked || '').replace('___', '<span class="sentence-masked-blank">______</span>');
      maskedSentenceEl.innerHTML = sentenceHtml;
    }

    // Ocultar sección revelada
    const revealedEl = document.getElementById('cardRevealedContent');
    if (revealedEl) revealedEl.classList.remove('visible');

    // 4. PREPARAR CONTENIDO REVELADO
    const transEl = document.getElementById('cardTranslation');
    if (transEl) transEl.textContent = word.translation;
    
    const fullSentenceEl = document.getElementById('cardSentenceFull');
    if (fullSentenceEl) {
      const formatted = (word.sentenceFull || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      fullSentenceEl.innerHTML = formatted;
    }

    const sentenceTransEl = document.getElementById('cardSentenceTrans');
    if (sentenceTransEl) sentenceTransEl.textContent = word.sentenceTrans || '';

    // Botón de audio para la frase
    const btnSentenceAudio = document.getElementById('btnPlaySentenceAudio');
    if (btnSentenceAudio) {
      btnSentenceAudio.onclick = (e) => {
        e.stopPropagation();
        this.playSentenceAudio(word);
      };
    }


    // 6. COLOCACIONES COMUNES
    const collocationsList = document.getElementById('cardCollocationsList');
    const collocationsWrap = document.getElementById('cardCollocationsWrap');
    if (collocationsList && collocationsWrap) {
      collocationsList.innerHTML = '';
      if (Array.isArray(word.collocations) && word.collocations.length > 0) {
        word.collocations.forEach(col => {
          const chip = document.createElement('span');
          chip.className = 'collocation-tag';
          chip.textContent = col;
          collocationsList.appendChild(chip);
        });
        collocationsWrap.style.display = 'block';
      } else {
        collocationsWrap.style.display = 'none';
      }
    }

    // Botones de acción inferior
    const btnReveal = document.getElementById('btnRevealAnswer');
    const ratingGroup = document.getElementById('ratingButtonsGroup');
    const quizGroup = document.getElementById('quizOptionsList');

    const settings = StorageManager.getSettings();
    if (settings.studyMode === 'quiz') {
      if (btnReveal) btnReveal.style.display = 'none';
      if (ratingGroup) ratingGroup.classList.remove('visible');
      if (quizGroup) {
        quizGroup.style.display = 'flex';
        this.renderQuizOptions(word);
      }
    } else {
      if (quizGroup) quizGroup.style.display = 'none';
      if (btnReveal) btnReveal.style.display = 'flex';
      if (ratingGroup) ratingGroup.classList.remove('visible');
    }

    // Resetear posición de la tarjeta
    if (this.cardElement) {
      this.cardElement.style.transform = '';
      this.cardElement.style.opacity = '1';
    }
  },

  revealAnswer() {
    if (this.isRevealed) return;
    this.isRevealed = true;

    const revealedEl = document.getElementById('cardRevealedContent');
    if (revealedEl) revealedEl.classList.add('visible');

    const btnReveal = document.getElementById('btnRevealAnswer');
    if (btnReveal) btnReveal.style.display = 'none';

    const ratingGroup = document.getElementById('ratingButtonsGroup');
    if (ratingGroup) ratingGroup.classList.add('visible');

    // Reproducción de audio automática si está activada
    const settings = StorageManager.getSettings();
    if (settings.autoPlayAudio) {
      this.playAudio();
    }
  },

  renderQuizOptions(word) {
    const list = document.getElementById('quizOptionsList');
    if (!list) return;
    list.innerHTML = '';

    const options = word.options ? [...word.options] : [word.translation];
    options.sort(() => Math.random() - 0.5);

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-card';
      btn.textContent = opt;
      btn.onclick = () => {
        if (opt === word.translation) {
          btn.classList.add('correct');
          setTimeout(() => this.rateWord('good'), 500);
        } else {
          btn.classList.add('incorrect');
          setTimeout(() => this.rateWord('hard'), 700);
        }
      };
      list.appendChild(btn);
    });
  },

  rateWord(rating) {
    // rating: 'hard' | 'good' | 'easy'
    const word = this.getCurrentWord();
    if (!word) return;

    // Animación de salida ergonómica
    if (this.cardElement) {
      let translateX = 0;
      let translateY = 0;
      if (rating === 'hard') translateX = -350;
      if (rating === 'easy') translateX = 350;
      if (rating === 'good') translateY = -350;

      this.cardElement.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
      this.cardElement.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) rotate(${translateX * 0.08}deg)`;
      this.cardElement.style.opacity = '0';
    }

    setTimeout(() => {
      // Actualizar en storage (SRS Leitner + Lote diario)
      StorageManager.updateWordRating(word.id, rating);

      // Si fue difícil, añadir de nuevo al final de la sesión para refuerzo inmediato
      if (rating === 'hard') {
        this.queue.push(word);
      }

      this.currentIndex++;
      this.renderCurrentCard();

      if (this.cardElement) {
        this.cardElement.style.transition = '';
      }
    }, 220);
  },

  playAudio() {
    const word = this.getCurrentWord();
    if (!word) return;

    // Si la palabra tiene audio nativo oficial (ej. Oxford Dictionaries MP3)
    if (word.audio && word.audio.startsWith('http')) {
      try {
        if (this._currentAudio) {
          this._currentAudio.pause();
          this._currentAudio.currentTime = 0;
        }
        this._currentAudio = new Audio(word.audio);
        const playPromise = this._currentAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            this._speakWord(word.word);
          });
        }
        return;
      } catch (e) {
        // Fallback
      }
    }

    this._speakWord(word.word);
  },

  _speakWord(text) {
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

  playSentenceAudio(word) {
    if (!word || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const rawSentence = (word.sentenceFull || '').replace(/\*\*/g, '');
    const utterance = new SpeechSynthesisUtterance(rawSentence);
    utterance.lang = 'en-US';

    const settings = StorageManager.getSettings();
    utterance.rate = (settings.speechRate || 0.9) * 0.95;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  },

  bindEvents() {
    const btnReveal = document.getElementById('btnRevealAnswer');
    if (btnReveal) {
      btnReveal.addEventListener('click', () => this.revealAnswer());
    }

    const btnAudio = document.getElementById('btnPlayAudio');
    if (btnAudio) {
      btnAudio.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playAudio();
      });
    }

    // Botones de rating táctiles
    const btnHard = document.getElementById('btnRateHard');
    const btnGood = document.getElementById('btnRateGood');
    const btnEasy = document.getElementById('btnRateEasy');

    if (btnHard) btnHard.addEventListener('click', () => this.rateWord('hard'));
    if (btnGood) btnGood.addEventListener('click', () => this.rateWord('good'));
    if (btnEasy) btnEasy.addEventListener('click', () => this.rateWord('easy'));

    // Botón reiniciar sesión en felicitaciones
    const btnRestart = document.getElementById('btnRestartSession');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        // Permitir nueva tanda de 10 palabras
        this.startSession();
      });
    }
  },

  bindGestures() {
    if (!this.cardElement) return;

    const card = this.cardElement;
    const indHard = document.getElementById('indicatorHard');
    const indGood = document.getElementById('indicatorGood');
    const indEasy = document.getElementById('indicatorEasy');

    const resetIndicators = () => {
      if (indHard) indHard.style.opacity = '0';
      if (indGood) indGood.style.opacity = '0';
      if (indEasy) indEasy.style.opacity = '0';
    };

    // Soporte Touch (Móvil nativo)
    card.addEventListener('touchstart', (e) => {
      const settings = StorageManager.getSettings();
      if (!settings.gesturesEnabled) return;

      this.isTouchDragging = true;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.deltaX = 0;
      this.deltaY = 0;
      card.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!this.isTouchDragging) return;

      this.deltaX = e.touches[0].clientX - this.touchStartX;
      this.deltaY = e.touches[0].clientY - this.touchStartY;

      const rot = this.deltaX * 0.05;
      card.style.transform = `translate3d(${this.deltaX}px, ${this.deltaY}px, 0) rotate(${rot}deg)`;

      resetIndicators();
      if (this.deltaX < -40 && indHard) {
        indHard.style.opacity = Math.min(Math.abs(this.deltaX) / 100, 1).toString();
      } else if (this.deltaX > 40 && indEasy) {
        indEasy.style.opacity = Math.min(Math.abs(this.deltaX) / 100, 1).toString();
      } else if (this.deltaY < -40 && indGood) {
        indGood.style.opacity = Math.min(Math.abs(this.deltaY) / 100, 1).toString();
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (!this.isTouchDragging) return;
      this.isTouchDragging = false;
      resetIndicators();

      const THRESHOLD = 80;

      if (this.deltaX < -THRESHOLD) {
        if (!this.isRevealed) this.revealAnswer();
        this.rateWord('hard');
      } else if (this.deltaX > THRESHOLD) {
        if (!this.isRevealed) this.revealAnswer();
        this.rateWord('easy');
      } else if (this.deltaY < -THRESHOLD) {
        if (!this.isRevealed) this.revealAnswer();
        this.rateWord('good');
      } else {
        card.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
        card.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
      }
    });

    // Soporte Mouse Drag para pruebas en escritorio
    let isMouseDown = false;
    card.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      const settings = StorageManager.getSettings();
      if (!settings.gesturesEnabled) return;
      isMouseDown = true;
      this.touchStartX = e.clientX;
      this.touchStartY = e.clientY;
      this.deltaX = 0;
      this.deltaY = 0;
      card.style.transition = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      this.deltaX = e.clientX - this.touchStartX;
      this.deltaY = e.clientY - this.touchStartY;
      const rot = this.deltaX * 0.05;
      card.style.transform = `translate3d(${this.deltaX}px, ${this.deltaY}px, 0) rotate(${rot}deg)`;

      resetIndicators();
      if (this.deltaX < -40 && indHard) {
        indHard.style.opacity = Math.min(Math.abs(this.deltaX) / 100, 1).toString();
      } else if (this.deltaX > 40 && indEasy) {
        indEasy.style.opacity = Math.min(Math.abs(this.deltaX) / 100, 1).toString();
      } else if (this.deltaY < -40 && indGood) {
        indGood.style.opacity = Math.min(Math.abs(this.deltaY) / 100, 1).toString();
      }
    });

    window.addEventListener('mouseup', () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      resetIndicators();
      const THRESHOLD = 80;

      if (this.deltaX < -THRESHOLD) {
        if (!this.isRevealed) this.revealAnswer();
        this.rateWord('hard');
      } else if (this.deltaX > THRESHOLD) {
        if (!this.isRevealed) this.revealAnswer();
        this.rateWord('easy');
      } else if (this.deltaY < -THRESHOLD) {
        if (!this.isRevealed) this.revealAnswer();
        this.rateWord('good');
      } else {
        card.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
        card.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
      }
    });
  }
};
