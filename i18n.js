/* ========================================================
   RACK4MASTER·AUTO  —  i18n.js
   Supported languages: en · es · ca
   Always boots in English; no persistence.
   ======================================================== */

const TRANSLATIONS = {
  en: {
    'app.sub':              'intelligent spectral & dynamic correction',
    'nav.help':             'Help',
    'nav.language':         'Language',
    'track.title':          'AUDIO TRACK',
    'track.nofile':         'NO FILE LOADED',
    'track.hint':           '↧ DROP AUDIO FILE or CLICK TO BROWSE',
    'btn.load':             '📂 LOAD',
    'btn.play':             '▶ PLAY',
    'btn.pause':            '⏸ PAUSE',
    'btn.stop':             '⏹ STOP',
    'btn.loop':             '🔄 LOOP',
    'btn.ab':               'A/B',
    'btn.ab.a':             'A · ORIGINAL',
    'btn.ab.b':             'B · MASTERED',
    'monitor.a':            'A: ORIGINAL',
    'monitor.b':            'B: MASTERED',
    'btn.analyze':          '🧠 ANALYZE & AUTO-CORRECT',
    'report.title':         '📊 SPECTRAL & DYNAMICS REPORT',
    'output.title':         'PROCESSED OUTPUT',
    'live.badge':           'LIVE CORRECTION ACTIVE',
    'fx.title':             '⚙️ PROCESSING CHAIN (auto-calculated)',
    'mod.eq':               '7-Band EQ',
    'mod.dyn':              'Dynamics + Harmonics',
    'mod.filter':           'Filter & M/S',
    'mod.out':              'Output Stage',
    'eq.sub':               'SUB 50Hz',
    'eq.bass':              'BASS 100Hz',
    'eq.lomid':             'LO-MID 300Hz',
    'eq.mid':               'MID 1kHz',
    'eq.himid':             'HI-MID 3kHz',
    'eq.presence':          'PRESENCE 8kHz',
    'eq.air':               'AIR 16kHz',
    'dyn.thr':              'THRESHOLD',
    'dyn.rat':              'RATIO',
    'dyn.atk':              'ATTACK (ms)',
    'dyn.rel':              'RELEASE (ms)',
    'dyn.mkp':              'MAKEUP GAIN',
    'dyn.sat':              'SATURATION',
    'flt.hpf':              'HPF FREQ',
    'flt.hpfq':             'HPF RESONANCE',
    'flt.mid':              'MID GAIN',
    'flt.side':             'SIDE GAIN',
    'out.lim':              'LIMITER CEILING',
    'out.gain':             'OUTPUT GAIN',
    'btn.savepreset':       '💾 SAVE PRESET',
    'btn.loadpreset':       '📂 LOAD PRESET',
    'btn.export':           '⬇ EXPORT WAV (corrected)',
    'btn.resetall':         '⟳ FULL RESET',
    'modal.title':          '⚠️ FULL RESET',
    'modal.msg':            'All loaded audio and settings will be cleared.\nThis action cannot be undone.',
    'modal.cancel':         'CANCEL',
    'modal.confirm':        'RESET',
    'status.ready':         'READY',
    'status.analyzing':     'ANALYZING ...',
    'status.noaudio':       'NO AUDIO',
    'status.decode_error':  'DECODE ERROR',
    'status.ready_ok':      'CORRECTION READY ✔',
    'status.rendering':     'RENDERING ...',
    'status.export_ok':     'EXPORT OK',
    'status.export_cancel': 'EXPORT CANCELLED',
    'status.preset_saved':  'PRESET SAVED ✔',
    'status.preset_loaded': 'PRESET LOADED ✔',
    'status.preset_error':  'PRESET ERROR',
    'footer.text':          '⚡ RACK4MASTER·AUTO — AI-inspired heuristics • Meyda spectral analysis • All processing in-browser • No data leaves your machine',
    'prompt.preset':        'Preset name:',
    'prompt.export':        'File name to download:',
    'rpt.decisions':        '📈 AUTO CORRECTION DECISIONS',
    'rpt.eq':               '🏛️ EQ (dB)',
    'rpt.dyn':              '⚡ Dynamics',
    'rpt.hpf':              '🔇 HPF / Saturation',
    'rpt.ms':               '📐 M/S',
    'rpt.output':           '🎚️ Output',
    'rpt.metrics':          '🧠 Metrics',
  },

  es: {
    'app.sub':              'corrección espectral y dinámica inteligente',
    'nav.help':             'Ayuda',
    'nav.language':         'Idioma',
    'track.title':          'PISTA DE AUDIO',
    'track.nofile':         'SIN ARCHIVO',
    'track.hint':           '↧ SUELTA UN ARCHIVO DE AUDIO o HAZ CLIC PARA BUSCAR',
    'btn.load':             '📂 CARGAR',
    'btn.play':             '▶ REPRODUCIR',
    'btn.pause':            '⏸ PAUSA',
    'btn.stop':             '⏹ DETENER',
    'btn.loop':             '🔄 BUCLE',
    'btn.ab':               'A/B',
    'btn.ab.a':             'A · ORIGINAL',
    'btn.ab.b':             'B · MASTERIZADO',
    'monitor.a':            'A: ORIGINAL',
    'monitor.b':            'B: MASTERIZADO',
    'btn.analyze':          '🧠 ANALIZAR Y AUTO-CORREGIR',
    'report.title':         '📊 INFORME ESPECTRAL Y DINÁMICO',
    'output.title':         'SALIDA PROCESADA',
    'live.badge':           'CORRECCIÓN EN VIVO ACTIVA',
    'fx.title':             '⚙️ CADENA DE PROCESO (auto-calculada)',
    'mod.eq':               'EQ 7 Bandas',
    'mod.dyn':              'Dinámica + Armónicos',
    'mod.filter':           'Filtro y M/S',
    'mod.out':              'Etapa de Salida',
    'eq.sub':               'SUB 50Hz',
    'eq.bass':              'BAJO 100Hz',
    'eq.lomid':             'BAJO-MED 300Hz',
    'eq.mid':               'MED 1kHz',
    'eq.himid':             'ALTO-MED 3kHz',
    'eq.presence':          'PRESENCIA 8kHz',
    'eq.air':               'AIRE 16kHz',
    'dyn.thr':              'UMBRAL',
    'dyn.rat':              'RATIO',
    'dyn.atk':              'ATAQUE (ms)',
    'dyn.rel':              'RELEASE (ms)',
    'dyn.mkp':              'GANANCIA MAKEUP',
    'dyn.sat':              'SATURACIÓN',
    'flt.hpf':              'FREC. HPF',
    'flt.hpfq':             'RESONANCIA HPF',
    'flt.mid':              'GANANCIA MID',
    'flt.side':             'GANANCIA SIDE',
    'out.lim':              'TECHO LIMITADOR',
    'out.gain':             'GANANCIA DE SALIDA',
    'btn.savepreset':       '💾 GUARDAR PRESET',
    'btn.loadpreset':       '📂 CARGAR PRESET',
    'btn.export':           '⬇ EXPORTAR WAV (corregido)',
    'btn.resetall':         '⟳ RESET COMPLETO',
    'modal.title':          '⚠️ RESET COMPLETO',
    'modal.msg':            'Se borrará el audio cargado y todos los ajustes.\nEsta acción no se puede deshacer.',
    'modal.cancel':         'CANCELAR',
    'modal.confirm':        'RESETEAR',
    'status.ready':         'LISTO',
    'status.analyzing':     'ANALIZANDO ...',
    'status.noaudio':       'SIN AUDIO',
    'status.decode_error':  'ERROR DE DECODIFICACIÓN',
    'status.ready_ok':      'CORRECCIÓN LISTA ✔',
    'status.rendering':     'PROCESANDO ...',
    'status.export_ok':     'EXPORTACIÓN OK',
    'status.export_cancel': 'EXPORTACIÓN CANCELADA',
    'status.preset_saved':  'PRESET GUARDADO ✔',
    'status.preset_loaded': 'PRESET CARGADO ✔',
    'status.preset_error':  'ERROR EN PRESET',
    'footer.text':          '⚡ RACK4MASTER·AUTO — Heurísticas con IA • Análisis espectral Meyda • Todo el proceso en el navegador • Tus datos no salen de tu equipo',
    'prompt.preset':        'Nombre del preset:',
    'prompt.export':        'Nombre del archivo a descargar:',
    'rpt.decisions':        '📈 DECISIONES DE AUTO-CORRECCIÓN',
    'rpt.eq':               '🏛️ EQ (dB)',
    'rpt.dyn':              '⚡ Dinámica',
    'rpt.hpf':              '🔇 HPF / Saturación',
    'rpt.ms':               '📐 M/S',
    'rpt.output':           '🎚️ Salida',
    'rpt.metrics':          '🧠 Métricas',
  },

  ca: {
    'app.sub':              'correcció espectral i dinàmica intel·ligent',
    'nav.help':             'Ajuda',
    'nav.language':         'Idioma',
    'track.title':          "PISTA D'ÀUDIO",
    'track.nofile':         'SENSE ARXIU',
    'track.hint':           "↧ ARROSSEGA UN ARXIU D'ÀUDIO o FES CLIC PER CERCAR",
    'btn.load':             '📂 CARREGAR',
    'btn.play':             '▶ REPRODUIR',
    'btn.pause':            '⏸ PAUSA',
    'btn.stop':             '⏹ ATURAR',
    'btn.loop':             '🔄 BUCLE',
    'btn.ab':               'A/B',
    'btn.ab.a':             'A · ORIGINAL',
    'btn.ab.b':             'B · MASTERITZAT',
    'monitor.a':            'A: ORIGINAL',
    'monitor.b':            'B: MASTERITZAT',
    'btn.analyze':          '🧠 ANALITZAR I AUTO-CORREGIR',
    'report.title':         '📊 INFORME ESPECTRAL I DINÀMIC',
    'output.title':         'SORTIDA PROCESSADA',
    'live.badge':           'CORRECCIÓ EN VIU ACTIVA',
    'fx.title':             '⚙️ CADENA DE PROCÉS (auto-calculada)',
    'mod.eq':               'EQ 7 Bandes',
    'mod.dyn':              'Dinàmica + Harmònics',
    'mod.filter':           'Filtre i M/S',
    'mod.out':              'Etapa de Sortida',
    'eq.sub':               'SUB 50Hz',
    'eq.bass':              'BAIX 100Hz',
    'eq.lomid':             'BAIX-MIG 300Hz',
    'eq.mid':               'MIG 1kHz',
    'eq.himid':             'ALT-MIG 3kHz',
    'eq.presence':          'PRESÈNCIA 8kHz',
    'eq.air':               'AIRE 16kHz',
    'dyn.thr':              'LLINDAR',
    'dyn.rat':              'RATIO',
    'dyn.atk':              'ATAC (ms)',
    'dyn.rel':              'ALLIBERAMENT (ms)',
    'dyn.mkp':              'GUANY MAKEUP',
    'dyn.sat':              'SATURACIÓ',
    'flt.hpf':              'FREQ. HPF',
    'flt.hpfq':             'RESSONÀNCIA HPF',
    'flt.mid':              'GUANY MID',
    'flt.side':             'GUANY SIDE',
    'out.lim':              'SOSTRE LIMITADOR',
    'out.gain':             'GUANY DE SORTIDA',
    'btn.savepreset':       '💾 DESAR PRESET',
    'btn.loadpreset':       '📂 CARREGAR PRESET',
    'btn.export':           '⬇ EXPORTAR WAV (corregit)',
    'btn.resetall':         '⟳ RESET COMPLET',
    'modal.title':          '⚠️ RESET COMPLET',
    'modal.msg':            "S'esborrarà l'àudio carregat i tots els ajustos.\nAquesta acció no es pot desfer.",
    'modal.cancel':         'CANCEL·LAR',
    'modal.confirm':        'REINICIAR',
    'status.ready':         'LLEST',
    'status.analyzing':     'ANALITZANT ...',
    'status.noaudio':       "SENSE ÀUDIO",
    'status.decode_error':  'ERROR DE DECODIFICACIÓ',
    'status.ready_ok':      'CORRECCIÓ LLESTA ✔',
    'status.rendering':     'PROCESSANT ...',
    'status.export_ok':     'EXPORTACIÓ OK',
    'status.export_cancel': "EXPORTACIÓ CANCEL·LADA",
    'status.preset_saved':  'PRESET DESAT ✔',
    'status.preset_loaded': 'PRESET CARREGAT ✔',
    'status.preset_error':  'ERROR EN PRESET',
    'footer.text':          '⚡ RACK4MASTER·AUTO — Heurístiques amb IA • Anàlisi espectral Meyda • Tot el procés al navegador • Les teves dades no surten del teu equip',
    'prompt.preset':        'Nom del preset:',
    'prompt.export':        "Nom de l'arxiu a descarregar:",
    'rpt.decisions':        "📈 DECISIONS D'AUTO-CORRECCIÓ",
    'rpt.eq':               '🏛️ EQ (dB)',
    'rpt.dyn':              '⚡ Dinàmica',
    'rpt.hpf':              '🔇 HPF / Saturació',
    'rpt.ms':               '📐 M/S',
    'rpt.output':           '🎚️ Sortida',
    'rpt.metrics':          '🧠 Mètriques',
  }
};

/* ---- Public API ---- */
let currentLang = 'en';

function t(key) {
  const lang = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];
  return lang[key] !== undefined ? lang[key] : (TRANSLATIONS['en'][key] || key);
}

function setLang(lang) {
  if (!TRANSLATIONS[lang]) lang = 'en';
  currentLang = lang;
  document.documentElement.lang = lang;

  // Update all static [data-i18n] elements
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    const key = el.getAttribute('data-i18n');
    // modal-msg uses pre-line whitespace so \n renders as line break
    el.textContent = t(key);
  });

  // Update active lang button highlight
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Update dynamic play/pause buttons based on current state
  const playTrackBtn = document.getElementById('playTrackBtn');
  const playOutBtn   = document.getElementById('playOutBtn');
  const monStatus    = document.getElementById('monStatus');
  if (playTrackBtn) {
    const isPlaying = playTrackBtn.textContent.includes('⏸');
    playTrackBtn.textContent = isPlaying ? t('btn.pause') : t('btn.play');
  }
  if (playOutBtn) {
    const isPlaying = playOutBtn.textContent.includes('⏸');
    playOutBtn.textContent = isPlaying ? t('btn.pause') : t('btn.play');
  }
  // monStatus uses data-i18n so it's already updated above,
  // but className needs to be preserved
  if (monStatus) {
    const isA = monStatus.classList.contains('mon-a');
    monStatus.textContent = t(isA ? 'monitor.a' : 'monitor.b');
  }
}

function initI18n() {
  // Always start in English — no persistence
  // Wire up lang buttons
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setLang(btn.dataset.lang);
    });
  });

  // Wire up hamburger toggle
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const hamMenu      = document.getElementById('hamMenu');
  if (hamburgerBtn && hamMenu) {
    hamburgerBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      hamMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', function() {
      hamMenu.classList.add('hidden');
    });
    hamMenu.addEventListener('click', function(e) { e.stopPropagation(); });
  }

  setLang('en');
}
