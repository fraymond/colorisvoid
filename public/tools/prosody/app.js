(function () {
  "use strict";

  var LABELS = { en: "English", de: "Deutsch", fr: "Français", it: "Italiano", es: "Español" };
  var BCP47 = { en: "en-US", de: "de-DE", fr: "fr-FR", it: "it-IT", es: "es-ES" };

  var SAMPLES = {
    en: { lines: [
      { text: "The quick brown fox jumps over the lazy dog.", words: [
        { t: ["The"], p: ["ðə"] },
        { t: ["quick"], p: ["kwɪk"] },
        { t: ["brown"], p: ["braʊn"] },
        { t: ["fox"], p: ["fɑks"] },
        { t: ["jumps"], p: ["dʒʌmps"] },
        { t: ["o", "ver"], p: ["ˈoʊ", "vɚ"] },
        { t: ["the"], p: ["ðə"] },
        { t: ["la", "zy"], p: ["ˈleɪ", "zi"] },
        { t: ["dog"], p: ["dɔːɡ"], punct: "." }
      ] },
      { text: "She sells seashells by the seashore.", words: [
        { t: ["She"], p: ["ʃi"] },
        { t: ["sells"], p: ["sɛlz"] },
        { t: ["sea", "shells"], p: ["ˈsiː", "ʃɛlz"] },
        { t: ["by"], p: ["baɪ"] },
        { t: ["the"], p: ["ðə"] },
        { t: ["sea", "shore"], p: ["ˈsiː", "ʃɔːr"], punct: "." }
      ] }
    ] },
    de: { lines: [
      { text: "Der schnelle Fuchs springt über den faulen Hund.", words: [
        { t: ["Der"], p: ["deːɐ̯"] },
        { t: ["schnel", "le"], p: ["ˈʃnɛ", "lə"] },
        { t: ["Fuchs"], p: ["fʊks"] },
        { t: ["springt"], p: ["ʃprɪŋt"] },
        { t: ["ü", "ber"], p: ["ˈyː", "bɐ"] },
        { t: ["den"], p: ["deːn"] },
        { t: ["fau", "len"], p: ["ˈfaʊ", "lən"] },
        { t: ["Hund"], p: ["hʊnt"], punct: "." }
      ] },
      { text: "Guten Morgen, wie geht es dir?", words: [
        { t: ["Gu", "ten"], p: ["ˈɡuː", "tn̩"] },
        { t: ["Mor", "gen"], p: ["ˈmɔʁ", "ɡn̩"], punct: "," },
        { t: ["wie"], p: ["viː"] },
        { t: ["geht"], p: ["ɡeːt"] },
        { t: ["es"], p: ["ɛs"] },
        { t: ["dir"], p: ["dɪɐ̯"], punct: "?" }
      ] }
    ] },
    fr: { lines: [
      { text: "Bonjour, comment allez-vous aujourd'hui ?", words: [
        { t: ["Bon", "jour"], p: ["bɔ̃", "ʒuʁ"], punct: "," },
        { t: ["com", "ment"], p: ["kɔ", "mɑ̃"] },
        { t: ["al", "lez", "vous"], p: ["a", "le", "vu"] },
        { t: ["au", "jourd'", "hui"], p: ["o", "ʒuʁ", "dɥi"], punct: " ?" }
      ] },
      { text: "Le chat noir dort sur le tapis.", words: [
        { t: ["Le"], p: ["lə"] },
        { t: ["chat"], p: ["ʃa"] },
        { t: ["noir"], p: ["nwaʁ"] },
        { t: ["dort"], p: ["dɔʁ"] },
        { t: ["sur"], p: ["syʁ"] },
        { t: ["le"], p: ["lə"] },
        { t: ["ta", "pis"], p: ["ta", "pi"], punct: "." }
      ] }
    ] },
    it: { lines: [
      { text: "Buongiorno, come stai oggi?", words: [
        { t: ["Buon", "gior", "no"], p: ["bwɔn", "ˈdʒor", "no"], punct: "," },
        { t: ["co", "me"], p: ["ˈko", "me"] },
        { t: ["stai"], p: ["ˈstai"] },
        { t: ["og", "gi"], p: ["ˈɔd", "dʒi"], punct: "?" }
      ] },
      { text: "Il gatto nero dorme sul tappeto.", words: [
        { t: ["Il"], p: ["il"] },
        { t: ["gat", "to"], p: ["ˈɡat", "to"] },
        { t: ["ne", "ro"], p: ["ˈne", "ro"] },
        { t: ["dor", "me"], p: ["ˈdɔr", "me"] },
        { t: ["sul"], p: ["sul"] },
        { t: ["tap", "pe", "to"], p: ["tap", "ˈpe", "to"], punct: "." }
      ] }
    ] },
    es: { lines: [
      { text: "Buenos días, ¿cómo estás hoy?", words: [
        { t: ["Bue", "nos"], p: ["ˈbwe", "nos"] },
        { t: ["dí", "as"], p: ["ˈdi", "as"], punct: "," },
        { t: ["Có", "mo"], p: ["ˈko", "mo"] },
        { t: ["es", "tás"], p: ["es", "ˈtas"] },
        { t: ["hoy"], p: ["oi"], punct: "?" }
      ] },
      { text: "El gato negro duerme en la alfombra.", words: [
        { t: ["El"], p: ["el"] },
        { t: ["ga", "to"], p: ["ˈɡa", "to"] },
        { t: ["ne", "gro"], p: ["ˈne", "ɣɾo"] },
        { t: ["duer", "me"], p: ["ˈdweɾ", "me"] },
        { t: ["en"], p: ["en"] },
        { t: ["la"], p: ["la"] },
        { t: ["al", "fom", "bra"], p: ["al", "ˈfom", "bɾa"], punct: "." }
      ] }
    ] }
  };

  var KEYWORDS = {
    en: ["the", "and", "is", "of", "to", "in", "you", "that", "it", "was", "for", "on", "with", "he", "she", "are"],
    de: ["der", "die", "das", "und", "ist", "nicht", "ich", "ein", "eine", "mit", "auf", "sie", "er", "zu", "den"],
    fr: ["le", "la", "les", "et", "est", "je", "vous", "une", "un", "que", "des", "dans", "pas", "pour", "avec"],
    it: ["il", "la", "che", "non", "gli", "sono", "con", "una", "per", "del", "di", "in", "questo"],
    es: ["el", "la", "que", "no", "con", "una", "es", "los", "de", "en", "por", "para", "del", "las"]
  };

  function normalize(s) { return s.replace(/\s+/g, " ").trim().toLowerCase(); }

  function detectLanguage(text) {
    var lower = text.toLowerCase();
    var words = lower.match(/[a-zàâäéèêëïîôöùûüçñáíóúãõ']+/g) || [];
    var scores = { en: 0, de: 0, fr: 0, it: 0, es: 0 };
    words.forEach(function (w) {
      for (var key in KEYWORDS) { if (KEYWORDS[key].indexOf(w) !== -1) scores[key]++; }
    });
    if (/[üßäö]/.test(lower)) scores.de += 2;
    if (/[ñ¿¡]/.test(lower)) scores.es += 2;
    if (/[çœ]/.test(lower)) scores.fr += 1;
    var best = "en", bestScore = -1;
    for (var k in scores) { if (scores[k] > bestScore) { bestScore = scores[k]; best = k; } }
    var total = words.length || 1;
    var confidence = Math.min(0.95, 0.35 + scores[best] / total);
    return { key: best, label: LABELS[best], bcp47: BCP47[best], confidence: confidence };
  }

  var VOWELS = "aeiouyàâäéèêëïîôöùûüáíóúãõ";
  var VOWELS_UP = VOWELS.toUpperCase();
  function naiveSyllables(word) {
    var clean = word.replace(/[^\p{L}'-]/gu, "");
    if (!clean) return [word];
    var re = new RegExp("[^" + VOWELS + VOWELS_UP + "]*[" + VOWELS + VOWELS_UP + "]+[^" + VOWELS + VOWELS_UP + "]*", "g");
    var m = clean.match(re);
    return (m && m.length) ? m : [clean];
  }

  function splitIntoSentences(text) {
    return text.split(/(?<=[.!?])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // Explicit line breaks in the source text define the speaking/highlight units;
  // only fall back to sentence-splitting for a single unbroken block of text.
  function splitIntoLines(text) {
    if (/\r?\n/.test(text)) {
      return text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return splitIntoSentences(text);
  }

  function naiveWordSplit(sentence) {
    var tokens = sentence.split(/\s+/).filter(Boolean);
    var words = [];
    tokens.forEach(function (tok) {
      if (!/\p{L}/u.test(tok)) {
        // No letters at all (e.g. a standalone "?" in French spacing) -- fold
        // into the previous word's punctuation instead of faking a
        // pronounceable "word" out of a bare punctuation mark. This also
        // keeps our word count aligned 1:1 with espeak-ng's output below.
        if (words.length) { words[words.length - 1].punct += tok; }
        return;
      }
      var m = tok.match(/^([\p{L}'-]+)([.,!?;:]*)$/u);
      var core = m ? m[1] : tok;
      var punct = m ? m[2] : "";
      var syl = naiveSyllables(core);
      words.push({ t: syl, p: syl.map(function (s) { return s.toLowerCase(); }), punct: punct });
    });
    return words;
  }

  // Real phonemization gives one IPA string per whole word, not per our
  // (orthographic, approximate) syllable chunk -- so divide it evenly across
  // however many syllable spans that word already has, character-wise. The
  // symbols are then genuine IPA; only the exact cut point is approximate.
  function splitIpaEvenly(ipa, n) {
    if (n <= 1 || !ipa) return [ipa || ""];
    var len = ipa.length;
    var base = Math.floor(len / n);
    var rem = len % n;
    var parts = [];
    var pos = 0;
    for (var i = 0; i < n; i++) {
      var size = base + (i < rem ? 1 : 0);
      parts.push(ipa.slice(pos, pos + size));
      pos += size;
    }
    return parts;
  }

  function phonemizeWords(words, languageKey) {
    return fetch("api/phonemize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: words, languageCode: languageKey })
    }).then(function (resp) {
      return resp.json().then(function (data) {
        if (!resp.ok) throw new Error(data.error || "Phonemizer request failed");
        return data.ipa;
      });
    });
  }

  function firstLineTitle(text) {
    var line = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || "Untitled";
    return line.length > 80 ? line.slice(0, 77) + "…" : line;
  }

  function slugify(s) {
    var slug = s.toLowerCase()
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return slug || "paragraph";
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // A <mark> placed inside a word's text (between two syllables) splits that
  // word into separate text nodes for Google's engine, which can break its
  // pronunciation (observed: "over" -> "o" + "ver" as two fragments). Marks
  // are only safe at word boundaries, so each word stays one intact run of
  // text and syllable-level timing is interpolated client-side afterwards.
  function buildSSML(line) {
    var parts = [];
    line.words.forEach(function (word, wi) {
      parts.push('<mark name="w' + wi + '"/>');
      parts.push(escapeXml(word.t.join("")));
      if (word.punct) parts.push(escapeXml(word.punct));
      if (wi < line.words.length - 1) parts.push(" ");
    });
    return "<speak>" + parts.join("") + "</speak>";
  }

  // Distribute each word's real timepoint across its syllables, weighted by
  // IPA length, so highlighting still moves syllable-by-syllable even though
  // only whole-word timing comes back from the TTS engine.
  function computeSyllableBoundaries(line, map, endTime) {
    var boundaries = [];
    line.words.forEach(function (word, wi) {
      var start = Object.prototype.hasOwnProperty.call(map, "w" + wi)
        ? map["w" + wi]
        : (boundaries.length ? boundaries[boundaries.length - 1] : 0);
      var next = Object.prototype.hasOwnProperty.call(map, "w" + (wi + 1)) ? map["w" + (wi + 1)] : endTime;
      if (typeof next !== "number" || next < start) next = start;
      var weights = word.p.map(function (s) { return Math.max(1, s.length); });
      var total = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
      var acc = 0;
      weights.forEach(function (w) {
        boundaries.push(start + (next - start) * (acc / total));
        acc += w;
      });
    });
    return boundaries;
  }

  var SPEEDS = [
    { value: 0.25, label: "25%" },
    { value: 0.5, label: "50%" },
    { value: 0.75, label: "75%" },
    { value: 1, label: "100%" }
  ];

  // ---- Interface language (English / Chinese) ----
  // This is the UI chrome's language, independent of the five languages a
  // pasted paragraph can be written in.
  var STRINGS = {
    en: {
      tagline: "Paste a paragraph, see it in IPA, hear every syllable at whatever speed you pick.",
      yourText: "Your text",
      paragraphLabel: "Paragraph",
      titleLabel: "Title",
      titlePlaceholder: "Defaults to the first line",
      analyzeBtn: "Detect & transcribe",
      analyzeBtnLoading: "Transcribing…",
      saveBtn: "Save",
      saveLocalBtn: "Use Offline",
      saveLocalBtnLoading: "Preparing…",
      saveStatusSaved: "Saved.",
      saveStatusError: "Couldn't save.",
      trySample: "Try a sample",
      savedParagraphs: "Saved paragraphs",
      savedEmpty: "Nothing saved yet.",
      savedLoadError: "Couldn't load saved paragraphs.",
      deleteSaved: "Delete saved paragraph",
      readAll: "Read all",
      stop: "Stop",
      ttsNotConfigured: "Google Cloud TTS isn't configured yet — add GOOGLE_TTS_API_KEY on the server (see .env.example) to enable playback.",
      playbackFailedLine: "Playback failed for this line.",
      playbackFailedGeneric: "Could not reach the speech engine.",
      draftNoteError: "Couldn't reach the phonemizer (espeak-ng) on the server, so syllables and IPA below fall back to an approximate placeholder instead of real phonemes.",
      playLineAriaPrefix: "Play line ",
      playLineAriaSuffix: " slowly",
      noAudioTitle: "Audio wasn't cached for this line when saved.",
      offlineTagline: "Saved from Prosody",
      offlineSpeedWord: "speed",
      offlineWorksOffline: "works offline, no internet needed.",
      offlineNoAudio: "text and IPA only — no audio was cached when this was saved.",
      offlineFooter: "A standalone snapshot from Prosody. IPA for automatically transcribed lines is an approximate, even split of real IPA rather than a precise phonetic boundary.",
      langNames: { en: "English", de: "German", fr: "French", it: "Italian", es: "Spanish" },
      confidenceSuffix: "% confidence",
      speedToggleLabel: "Speed",
      timeJustNow: "just now",
      timeMinuteSuffix: "m ago",
      timeHourSuffix: "h ago",
      timeDaySuffix: "d ago"
    },
    zh: {
      tagline: "粘贴一段文字,即可查看国际音标,还能按你选择的速度逐音节聆听发音。",
      yourText: "你的文本",
      paragraphLabel: "段落",
      titleLabel: "标题",
      titlePlaceholder: "默认使用第一行",
      analyzeBtn: "识别并转写",
      analyzeBtnLoading: "转写中…",
      saveBtn: "保存",
      saveLocalBtn: "离线使用",
      saveLocalBtnLoading: "准备中…",
      saveStatusSaved: "已保存。",
      saveStatusError: "保存失败。",
      trySample: "试试示例",
      savedParagraphs: "已保存的段落",
      savedEmpty: "还没有保存任何内容。",
      savedLoadError: "无法加载已保存的段落。",
      deleteSaved: "删除已保存的段落",
      readAll: "全部朗读",
      stop: "停止",
      ttsNotConfigured: "尚未配置 Google Cloud TTS —— 请在服务器上设置 GOOGLE_TTS_API_KEY(参见 .env.example)以启用朗读功能。",
      playbackFailedLine: "该行朗读失败。",
      playbackFailedGeneric: "无法连接语音引擎。",
      draftNoteError: "无法连接服务器上的自动注音引擎(espeak-ng),因此以下音节与音标暂时使用近似占位符,而非真实音素。",
      playLineAriaPrefix: "慢速朗读第 ",
      playLineAriaSuffix: " 行",
      noAudioTitle: "保存时未缓存此行的音频。",
      offlineTagline: "保存自 Prosody",
      offlineSpeedWord: "速度",
      offlineWorksOffline: "可离线使用,无需联网。",
      offlineNoAudio: "仅含文本与音标 —— 保存时未缓存音频。",
      offlineFooter: "这是来自 Prosody 的独立快照。自动转写行的音标切分点只是对真实音标的均等切分,并非精确的语音学边界。",
      langNames: { en: "英语", de: "德语", fr: "法语", it: "意大利语", es: "西班牙语" },
      confidenceSuffix: "% 置信度",
      speedToggleLabel: "朗读速度",
      timeJustNow: "刚刚",
      timeMinuteSuffix: "分钟前",
      timeHourSuffix: "小时前",
      timeDaySuffix: "天前"
    }
  };

  var currentLocale = "zh";
  try {
    var savedLocale = localStorage.getItem("prosody-locale");
    if (savedLocale === "en" || savedLocale === "zh") currentLocale = savedLocale;
  } catch (e) { /* private browsing / blocked storage */ }

  function tr() { return STRINGS[currentLocale]; }

  // ---- DOM refs ----
  var textarea = document.getElementById("input-text");
  var titleInput = document.getElementById("title-input");
  var analyzeBtn = document.getElementById("analyze-btn");
  var saveBtn = document.getElementById("save-btn");
  var saveLocalBtn = document.getElementById("save-local-btn");
  var saveStatus = document.getElementById("save-status");
  var chipsEl = document.getElementById("sample-chips");
  var savedListEl = document.getElementById("saved-list");
  var detectedText = document.getElementById("detected-text");
  var linesEl = document.getElementById("lines");
  var readAllBtn = document.getElementById("read-all-btn");
  var speedToggleEl = document.getElementById("speed-toggle");
  var langToggleEl = document.getElementById("lang-toggle");
  var ttsNoteEl = document.getElementById("tts-note");
  var draftNoteEl = document.getElementById("draft-note");
  var txtTagline = document.getElementById("txt-tagline");
  var txtYourText = document.getElementById("txt-your-text");
  var txtParagraphLabel = document.getElementById("txt-paragraph-label");
  var txtTitleLabel = document.getElementById("txt-title-label");
  var txtTrySample = document.getElementById("txt-try-sample");
  var txtSavedParagraphs = document.getElementById("txt-saved-paragraphs");
  var txtSpeedLabel = document.getElementById("txt-speed-label");

  var ttsConfigured = null;
  var currentBcp47 = "en-US";
  var currentLangKey = "en";
  var currentSpeed = 0.5;
  var currentLines = [];   // [{text, words, flat:[{textEl,ipaEl}], _cache:{}}]
  var lineRefs = [];       // [{row, playBtn}]
  var playingIndex = null;
  var readAllActive = false;
  var currentAudio = null;

  function renderSpeedToggle() {
    speedToggleEl.innerHTML = "";
    SPEEDS.forEach(function (s) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = s.label;
      btn.setAttribute("aria-pressed", s.value === currentSpeed ? "true" : "false");
      btn.addEventListener("click", function () {
        if (currentSpeed === s.value) return;
        stopAll();
        currentSpeed = s.value;
        renderSpeedToggle();
      });
      speedToggleEl.appendChild(btn);
    });
  }

  function setPlayIcon(btn, playing) {
    btn.innerHTML = playing
      ? '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="1.5" fill="currentColor"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 1.2 10 6 2.5 10.8Z" fill="currentColor"/></svg>';
  }

  function showTtsError(msg) {
    ttsNoteEl.textContent = msg;
    ttsNoteEl.hidden = false;
  }

  function cleanupLine(idx) {
    var ref = lineRefs[idx];
    var line = currentLines[idx];
    if (!ref || !line) return;
    ref.row.classList.remove("playing");
    setPlayIcon(ref.playBtn, false);
    ref.playBtn.disabled = false;
    (line.flat || []).forEach(function (s) {
      s.textEl.classList.remove("active", "done");
      s.ipaEl.classList.remove("active", "done");
    });
  }

  // Aborts whatever audio is currently playing/loading and resets per-line
  // visuals, but leaves readAllActive alone -- playLine() calls this before
  // starting each line, including the ones Read All triggers itself, so it
  // must not be the thing that cancels a Read All sequence in progress.
  function abortCurrentAudio() {
    if (currentAudio) {
      // Clearing src on an in-flight <audio> fires its own "error" event;
      // detach handlers first so that doesn't misreport a *later* playback.
      currentAudio.onerror = null;
      currentAudio.onended = null;
      currentAudio.ontimeupdate = null;
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }
    lineRefs.forEach(function (_, i) { cleanupLine(i); });
    playingIndex = null;
  }

  // User-facing stop: aborts audio AND cancels any Read All sequence.
  function stopAll() {
    abortCurrentAudio();
    readAllActive = false;
    readAllBtn.textContent = tr().readAll;
  }

  function fetchLineAudio(line, speed) {
    line._cache = line._cache || {};
    var key = String(speed);
    if (line._cache[key]) return Promise.resolve(line._cache[key]);

    var ssml = buildSSML(line);
    return fetch("api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssml: ssml, languageCode: currentBcp47, speakingRate: speed })
    })
      .then(function (resp) {
        return resp.json().then(function (data) {
          if (!resp.ok) throw new Error(data.error || "TTS request failed");
          return data;
        });
      })
      .then(function (data) {
        line._cache[key] = data;
        return data;
      });
  }

  function playLine(idx, onDone) {
    abortCurrentAudio();
    var line = currentLines[idx];
    var ref = lineRefs[idx];
    if (!line || !ref) return;

    if (ttsConfigured === false) {
      showTtsError(tr().ttsNotConfigured);
      return;
    }

    ref.row.classList.add("playing");
    setPlayIcon(ref.playBtn, true);
    ref.playBtn.disabled = true;
    playingIndex = idx;
    ttsNoteEl.hidden = true;

    fetchLineAudio(line, currentSpeed)
      .then(function (data) {
        ref.playBtn.disabled = false;
        var map = {};
        (data.timepoints || []).forEach(function (tp) { map[tp.markName] = tp.timeSeconds; });

        var audio = new Audio("data:audio/mp3;base64," + data.audioContent);
        currentAudio = audio;

        var boundaries = null;
        function ensureBoundaries() {
          if (!boundaries && audio.duration) {
            boundaries = computeSyllableBoundaries(line, map, audio.duration);
          }
          return boundaries;
        }

        // Assigned (not addEventListener) so stopAll() can detach them by
        // nulling the property when it intentionally aborts this element.
        audio.ontimeupdate = function () {
          var b = ensureBoundaries();
          if (!b) return;
          var t = audio.currentTime;
          var activeIdx = -1;
          for (var i = 0; i < b.length; i++) {
            if (t >= b[i]) activeIdx = i; else break;
          }
          line.flat.forEach(function (s, i) {
            s.textEl.classList.toggle("active", i === activeIdx);
            s.ipaEl.classList.toggle("active", i === activeIdx);
            s.textEl.classList.toggle("done", i < activeIdx);
            s.ipaEl.classList.toggle("done", i < activeIdx);
          });
        };
        audio.onended = function () {
          cleanupLine(idx);
          playingIndex = null;
          if (onDone) onDone();
        };
        audio.onerror = function () {
          cleanupLine(idx);
          playingIndex = null;
          showTtsError(tr().playbackFailedLine);
        };

        return audio.play();
      })
      .catch(function (err) {
        cleanupLine(idx);
        playingIndex = null;
        showTtsError(err.message || tr().playbackFailedGeneric);
      });
  }

  readAllBtn.addEventListener("click", function () {
    if (readAllActive || playingIndex !== null) { stopAll(); return; }
    if (!currentLines.length) return;
    readAllActive = true;
    readAllBtn.textContent = tr().stop;
    var i = 0;
    (function next() {
      if (!readAllActive || i >= currentLines.length) { readAllActive = false; readAllBtn.textContent = tr().readAll; return; }
      var idx = i; i++;
      playLine(idx, next);
    })();
  });

  function buildLineRow(line, idx) {
    var row = document.createElement("div");
    row.className = "line-row";

    var playBtn = document.createElement("button");
    playBtn.className = "play-btn";
    playBtn.setAttribute("aria-label", tr().playLineAriaPrefix + (idx + 1) + tr().playLineAriaSuffix);
    setPlayIcon(playBtn, false);
    playBtn.addEventListener("click", function () {
      if (playingIndex === idx) { stopAll(); }
      // A direct click on a line always cancels any Read All in progress
      // first, so that sequence doesn't silently resume after this line.
      else { stopAll(); playLine(idx); }
    });
    row.appendChild(playBtn);

    var content = document.createElement("div");
    content.className = "line-content";

    var textRow = document.createElement("div");
    textRow.className = "text-row";
    var ipaRow = document.createElement("div");
    ipaRow.className = "ipa-row";

    var openSlash = document.createElement("span");
    openSlash.className = "ipa-slash";
    openSlash.textContent = "/";
    ipaRow.appendChild(openSlash);

    var flat = [];

    line.words.forEach(function (word, wi) {
      word.t.forEach(function (syl, si) {
        var tEl = document.createElement("span");
        tEl.className = "syll";
        tEl.textContent = syl;
        textRow.appendChild(tEl);

        var pEl = document.createElement("span");
        pEl.className = "syll";
        pEl.textContent = word.p[si];
        ipaRow.appendChild(pEl);

        flat.push({ textEl: tEl, ipaEl: pEl });

        if (si < word.t.length - 1) {
          var dotP = document.createElement("span");
          dotP.className = "dot"; dotP.textContent = ".";
          ipaRow.appendChild(dotP);
        }
      });
      if (word.punct) { textRow.appendChild(document.createTextNode(word.punct)); }
      if (wi < line.words.length - 1) {
        textRow.appendChild(document.createTextNode(" "));
        ipaRow.appendChild(document.createTextNode(" "));
      }
    });

    var closeSlash = document.createElement("span");
    closeSlash.className = "ipa-slash";
    closeSlash.textContent = "/";
    ipaRow.appendChild(closeSlash);

    content.appendChild(textRow);
    content.appendChild(ipaRow);
    row.appendChild(content);

    linesEl.appendChild(row);
    lineRefs.push({ row: row, playBtn: playBtn });
    line.flat = flat;
  }

  // Kept so a locale switch can repaint the current results (labels, notes,
  // aria text, "Auto" tags) without re-running detection or re-fetching IPA.
  var lastRender = null;

  function render(langKey, lines, isDraft, confidence) {
    lastRender = { langKey: langKey, lines: lines, isDraft: isDraft, confidence: confidence };

    stopAll();
    linesEl.innerHTML = "";
    lineRefs = [];
    currentLines = [];
    currentLangKey = langKey;
    currentBcp47 = BCP47[langKey] || "en-US";

    var name = tr().langNames[langKey] || langKey;
    detectedText.innerHTML = "<b>" + name + "</b>" +
      (confidence ? ' <span class="confidence">· ' + Math.round(confidence * 100) + tr().confidenceSuffix + "</span>" : "");

    // Only surfaced on an actual phonemizer failure (see analyze()'s catch);
    // otherwise stays hidden -- no routine "this is auto-generated" note.
    draftNoteEl.hidden = true;

    lines.forEach(function (l, i) {
      var line = { text: l.text, words: l.words, isDraft: isDraft };
      currentLines.push(line);
      buildLineRow(line, i);
    });
  }

  // Matches curated sample text exactly, else falls back to the heuristic
  // detector -- used both when rendering and when saving, so the language a
  // paragraph is saved under always reflects its actual text, not whatever
  // was last analyzed (which could be stale if the textarea changed since).
  function matchedSampleKey(text) {
    for (var key in SAMPLES) {
      var sampleFull = SAMPLES[key].lines.map(function (l) { return l.text; }).join(" ");
      if (normalize(sampleFull) === normalize(text)) return key;
    }
    return null;
  }

  function resolveLanguageKey(text) {
    return matchedSampleKey(text) || detectLanguage(text).key;
  }

  function analyze() {
    var text = textarea.value.trim();
    if (!text) return;
    var matchedKey = matchedSampleKey(text);
    setActiveChip(matchedKey);

    if (matchedKey) {
      render(matchedKey, SAMPLES[matchedKey].lines, false);
      return;
    }

    var detected = detectLanguage(text);
    var draftLines = splitIntoLines(text).map(function (s) {
      return { text: s, words: naiveWordSplit(s) };
    });

    // Render immediately with a placeholder, then upgrade to real IPA once
    // the phonemizer responds, so the UI never sits blank on a slow request.
    render(detected.key, draftLines, true, detected.confidence);

    var flatWords = [];
    draftLines.forEach(function (l) { l.words.forEach(function (w) { flatWords.push(w.t.join("")); }); });
    if (!flatWords.length) return;

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = tr().analyzeBtnLoading;

    phonemizeWords(flatWords, detected.key)
      .then(function (ipaList) {
        var idx = 0;
        draftLines.forEach(function (l) {
          l.words.forEach(function (w) {
            w.p = splitIpaEvenly(ipaList[idx++] || "", w.t.length);
          });
        });
        if (textarea.value.trim() === text) {
          render(detected.key, draftLines, true, detected.confidence);
        }
      })
      .catch(function () {
        draftNoteEl.textContent = tr().draftNoteError;
        draftNoteEl.hidden = false;
      })
      .then(function () {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = tr().analyzeBtn;
      });
  }

  analyzeBtn.addEventListener("click", analyze);

  function setActiveChip(key) {
    Array.prototype.forEach.call(chipsEl.children, function (chip) {
      chip.setAttribute("aria-pressed", chip.dataset.key === key ? "true" : "false");
    });
  }

  Object.keys(SAMPLES).forEach(function (key) {
    var chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = LABELS[key];
    chip.dataset.key = key;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", function () {
      textarea.value = SAMPLES[key].lines.map(function (l) { return l.text; }).join("\n");
      analyze();
    });
    chipsEl.appendChild(chip);
  });

  // ---- Saved paragraphs (persisted server-side in SQLite) ----

  function flashSaveStatus(msg) {
    saveStatus.textContent = msg;
    setTimeout(function () { if (saveStatus.textContent === msg) saveStatus.textContent = ""; }, 2500);
  }

  function timeAgo(iso) {
    var s = tr();
    var then = new Date(iso.replace(" ", "T") + "Z").getTime();
    var diff = Math.max(0, Date.now() - then);
    var mins = Math.round(diff / 60000);
    if (mins < 1) return s.timeJustNow;
    if (mins < 60) return mins + s.timeMinuteSuffix;
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + s.timeHourSuffix;
    return Math.round(hrs / 24) + s.timeDaySuffix;
  }

  function loadSavedParagraphs() {
    fetch("api/paragraphs")
      .then(function (r) { return r.json(); })
      .then(renderSavedList)
      .catch(function () {
        savedListEl.innerHTML = "";
        var errEl = document.createElement("p");
        errEl.className = "saved-empty";
        errEl.textContent = tr().savedLoadError;
        savedListEl.appendChild(errEl);
      });
  }

  function renderSavedList(items) {
    savedListEl.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("p");
      empty.className = "saved-empty";
      empty.textContent = tr().savedEmpty;
      savedListEl.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "saved-item";

      var meta = document.createElement("span");
      meta.className = "meta";
      var preview = document.createElement("span");
      preview.className = "preview";
      preview.textContent = item.title || item.text.replace(/\s+/g, " ");
      var sub = document.createElement("span");
      sub.className = "sub";
      sub.textContent = (tr().langNames[item.language] || item.language) + " · " + timeAgo(item.created_at);
      meta.appendChild(preview);
      meta.appendChild(document.createElement("br"));
      meta.appendChild(sub);

      var del = document.createElement("span");
      del.className = "del-btn";
      del.textContent = "×";
      del.setAttribute("role", "button");
      del.setAttribute("aria-label", tr().deleteSaved);
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        fetch("api/paragraphs/" + item.id, { method: "DELETE" }).then(loadSavedParagraphs);
      });

      row.appendChild(meta);
      row.appendChild(del);
      row.addEventListener("click", function () {
        loadParagraph(item);
        setParagraphUrl(item.id);
      });

      savedListEl.appendChild(row);
    });
  }

  function loadParagraph(item) {
    textarea.value = item.text;
    titleInput.value = item.title || "";
    analyze();
  }

  // Gives a saved paragraph its own bookmarkable/shareable URL (/p/:id).
  function setParagraphUrl(id) {
    try { history.pushState({ paragraphId: id }, "", "p/" + id); } catch (e) { /* ignore */ }
  }

  saveBtn.addEventListener("click", function () {
    var text = textarea.value.trim();
    if (!text) return;
    var title = titleInput.value.trim() || firstLineTitle(text);
    var language = resolveLanguageKey(text);
    fetch("api/paragraphs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, title: title, language: language })
    })
      .then(function (r) { return r.json(); })
      .then(function (row) {
        flashSaveStatus(tr().saveStatusSaved);
        setParagraphUrl(row.id);
        loadSavedParagraphs();
      })
      .catch(function () { flashSaveStatus(tr().saveStatusError); });
  });

  // ---- Save local copy: a standalone HTML file, playable offline ----
  // Trimmed clone of the page's own look, embedded as a string so the
  // downloaded file needs no server, no fonts CDN, and no network calls.
  var OFFLINE_CSS = [
    ":root{--ink:#171b21;--paper:#f1f2ee;--paper-raised:#fff;--line:#dcded7;--muted:#666b6f;",
    "--accent:#146e67;--highlight:#e2932a;--highlight-soft:#fbe6c4;--highlight-ink:#3e2803;--danger:#a8461f;}",
    "@media (prefers-color-scheme: dark){:root:not([data-theme=light]){--ink:#e9eae5;--paper:#14171b;",
    "--paper-raised:#1c2025;--line:#2c3137;--muted:#9aa0a6;--accent:#3fb7ac;--highlight:#f0ab4c;",
    "--highlight-soft:#3d2c0c;--highlight-ink:#ffe7bb;--danger:#e2825b;}}",
    "*{box-sizing:border-box;}html,body{margin:0;}",
    "body{background:var(--paper);color:var(--ink);font-family:'Source Sans 3',ui-sans-serif,system-ui,sans-serif;",
    "padding-inline:20px;padding-block:28px 48px;max-width:820px;margin-inline:auto;}",
    "h1{font-family:Georgia,serif;margin:0;font-size:1.7rem;}",
    "p{margin:0;}.tagline{color:var(--muted);font-size:0.92rem;margin-top:6px;}",
    "header.top{padding-bottom:18px;margin-bottom:22px;border-bottom:1px solid var(--line);}",
    ".btn{appearance:none;border:1px solid var(--line);cursor:pointer;background:var(--paper-raised);",
    "color:var(--accent);font-weight:600;font-size:0.92rem;border-radius:9px;padding:10px 16px;}",
    ".btn:hover{border-color:var(--accent);}",
    ".lines{display:flex;flex-direction:column;}",
    ".line-row{display:flex;gap:12px;align-items:flex-start;padding-block:12px;}",
    ".line-row+.line-row{border-top:1px solid var(--line);}",
    ".play-btn{appearance:none;cursor:pointer;border:1px solid var(--line);background:var(--paper-raised);",
    "color:var(--accent);border-radius:50%;width:34px;height:34px;flex:none;display:flex;",
    "align-items:center;justify-content:center;margin-top:2px;}",
    ".line-row.playing .play-btn{background:var(--accent);color:#fff;border-color:var(--accent);}",
    ".play-btn:disabled{opacity:0.45;cursor:not-allowed;}",
    ".line-content{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;}",
    ".text-row{font-size:1.22rem;line-height:1.6;}",
    ".ipa-row{font-family:'Gentium Plus','Doulos SIL',serif;font-style:italic;font-size:1.04rem;",
    "color:var(--muted);line-height:1.6;}",
    ".syll{padding:0.05em 0.08em;border-radius:4px;}",
    ".syll.done{opacity:0.55;}",
    ".syll.active{background:var(--highlight);color:var(--highlight-ink);font-weight:600;}",
    ".ipa-row .syll.active{background:var(--highlight-soft);color:var(--highlight-ink);font-weight:600;}",
    ".dot{color:var(--muted);opacity:0.6;}",
    ".ipa-slash{color:var(--muted);opacity:0.7;}",
    "footer.note{margin-top:30px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);",
    "font-size:0.8rem;line-height:1.5;}"
  ].join("");

  // Runs inside the downloaded file only — no closures over the live app,
  // just DATA (pre-fetched text/IPA/audio) passed in when it's invoked there.
  function offlineApp(DATA, L) {
    "use strict";
    function setIcon(btn, playing) {
      btn.innerHTML = playing
        ? '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="1.5" fill="currentColor"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 1.2 10 6 2.5 10.8Z" fill="currentColor"/></svg>';
    }

    var linesEl = document.getElementById("lines");
    var readAllBtn = document.getElementById("read-all-btn");
    var refs = [];
    var playingIndex = null;
    var readAllActive = false;
    var currentAudio = null;

    function cleanup(idx) {
      var ref = refs[idx], line = DATA[idx];
      if (!ref || !line) return;
      ref.row.classList.remove("playing");
      setIcon(ref.playBtn, false);
      (line.flat || []).forEach(function (s) {
        s.textEl.classList.remove("active", "done");
        s.ipaEl.classList.remove("active", "done");
      });
    }

    function abortCurrentAudio() {
      if (currentAudio) {
        currentAudio.onerror = null;
        currentAudio.onended = null;
        currentAudio.ontimeupdate = null;
        currentAudio.pause();
        currentAudio.src = "";
        currentAudio = null;
      }
      refs.forEach(function (_, i) { cleanup(i); });
      playingIndex = null;
    }

    function stopAll() {
      abortCurrentAudio();
      readAllActive = false;
      readAllBtn.textContent = L.readAll;
    }

    function playLine(idx, onDone) {
      abortCurrentAudio();
      var line = DATA[idx], ref = refs[idx];
      if (!line || !ref || !line.audioContent) { if (onDone) onDone(); return; }
      ref.row.classList.add("playing");
      setIcon(ref.playBtn, true);
      playingIndex = idx;

      var map = {};
      (line.timepoints || []).forEach(function (tp) { map[tp.markName] = tp.timeSeconds; });

      var audio = new Audio("data:audio/mp3;base64," + line.audioContent);
      currentAudio = audio;

      var boundaries = null;
      function ensureBoundaries() {
        if (!boundaries && audio.duration) {
          boundaries = [];
          line.words.forEach(function (word, wi) {
            var start = Object.prototype.hasOwnProperty.call(map, "w" + wi)
              ? map["w" + wi]
              : (boundaries.length ? boundaries[boundaries.length - 1] : 0);
            var next = Object.prototype.hasOwnProperty.call(map, "w" + (wi + 1)) ? map["w" + (wi + 1)] : audio.duration;
            if (typeof next !== "number" || next < start) next = start;
            var weights = word.p.map(function (s) { return Math.max(1, s.length); });
            var total = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
            var acc = 0;
            weights.forEach(function (w) {
              boundaries.push(start + (next - start) * (acc / total));
              acc += w;
            });
          });
        }
        return boundaries;
      }

      audio.ontimeupdate = function () {
        var b = ensureBoundaries();
        if (!b) return;
        var t = audio.currentTime, activeIdx = -1;
        for (var i = 0; i < b.length; i++) { if (t >= b[i]) activeIdx = i; else break; }
        line.flat.forEach(function (s, i) {
          s.textEl.classList.toggle("active", i === activeIdx);
          s.ipaEl.classList.toggle("active", i === activeIdx);
          s.textEl.classList.toggle("done", i < activeIdx);
          s.ipaEl.classList.toggle("done", i < activeIdx);
        });
      };
      audio.onended = function () { cleanup(idx); playingIndex = null; if (onDone) onDone(); };
      audio.onerror = function () { cleanup(idx); playingIndex = null; };
      audio.play();
    }

    readAllBtn.addEventListener("click", function () {
      if (readAllActive || playingIndex !== null) { stopAll(); return; }
      if (!DATA.length) return;
      readAllActive = true;
      readAllBtn.textContent = L.stop;
      var i = 0;
      (function next() {
        if (!readAllActive || i >= DATA.length) { readAllActive = false; readAllBtn.textContent = L.readAll; return; }
        var idx = i; i++;
        playLine(idx, next);
      })();
    });

    DATA.forEach(function (line, idx) {
      var row = document.createElement("div");
      row.className = "line-row";

      var playBtn = document.createElement("button");
      playBtn.className = "play-btn";
      playBtn.setAttribute("aria-label", L.playLineAriaPrefix + (idx + 1) + L.playLineAriaSuffix);
      if (!line.audioContent) { playBtn.disabled = true; playBtn.title = L.noAudioTitle; }
      setIcon(playBtn, false);
      playBtn.addEventListener("click", function () {
        if (playingIndex === idx) { stopAll(); } else { stopAll(); playLine(idx); }
      });
      row.appendChild(playBtn);

      var content = document.createElement("div");
      content.className = "line-content";

      var textRow = document.createElement("div");
      textRow.className = "text-row";
      var ipaRow = document.createElement("div");
      ipaRow.className = "ipa-row";

      var openSlash = document.createElement("span");
      openSlash.className = "ipa-slash";
      openSlash.textContent = "/";
      ipaRow.appendChild(openSlash);

      var flat = [];
      line.words.forEach(function (word, wi) {
        word.t.forEach(function (syl, si) {
          var tEl = document.createElement("span");
          tEl.className = "syll"; tEl.textContent = syl;
          textRow.appendChild(tEl);

          var pEl = document.createElement("span");
          pEl.className = "syll"; pEl.textContent = word.p[si];
          ipaRow.appendChild(pEl);

          flat.push({ textEl: tEl, ipaEl: pEl });

          if (si < word.t.length - 1) {
            var dotP = document.createElement("span");
            dotP.className = "dot"; dotP.textContent = ".";
            ipaRow.appendChild(dotP);
          }
        });
        if (word.punct) { textRow.appendChild(document.createTextNode(word.punct)); }
        if (wi < line.words.length - 1) {
          textRow.appendChild(document.createTextNode(" "));
          ipaRow.appendChild(document.createTextNode(" "));
        }
      });

      var closeSlash = document.createElement("span");
      closeSlash.className = "ipa-slash";
      closeSlash.textContent = "/";
      ipaRow.appendChild(closeSlash);

      content.appendChild(textRow);
      content.appendChild(ipaRow);
      row.appendChild(content);

      linesEl.appendChild(row);
      refs.push({ row: row, playBtn: playBtn });
      line.flat = flat;
    });
  }

  function buildOfflineDoc(title, lines, ttsResults, speed) {
    var payload = lines.map(function (line, i) {
      var res = ttsResults[i];
      return {
        isDraft: !!line.isDraft,
        words: line.words,
        audioContent: res ? res.audioContent : null,
        timepoints: res ? res.timepoints : null
      };
    });
    var s = tr();
    var L = {
      readAll: s.readAll,
      stop: s.stop,
      playLineAriaPrefix: s.playLineAriaPrefix,
      playLineAriaSuffix: s.playLineAriaSuffix,
      noAudioTitle: s.noAudioTitle
    };
    var dataJson = JSON.stringify(payload).replace(/</g, "\\u003c");
    var lJson = JSON.stringify(L).replace(/</g, "\\u003c");
    var titleEsc = escapeXml(title);
    var speedLabel = Math.round(speed * 100) + "%";
    var anyAudio = payload.some(function (l) { return l.audioContent; });

    return [
      "<!doctype html>",
      '<html lang="' + currentLocale + '"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>" + titleEsc + "</title>",
      "<style>" + OFFLINE_CSS + "</style>",
      "</head><body>",
      '<header class="top"><h1>' + titleEsc + "</h1>",
      '<p class="tagline">' + escapeXml(s.offlineTagline) + " · " + speedLabel + " " + escapeXml(s.offlineSpeedWord) + " · " +
        escapeXml(anyAudio ? s.offlineWorksOffline : s.offlineNoAudio) +
        "</p></header>",
      '<div class="lines" id="lines"></div>',
      '<p style="margin-top:16px;"><button class="btn" id="read-all-btn">' + escapeXml(s.readAll) + "</button></p>",
      '<footer class="note">' + escapeXml(s.offlineFooter) + "</footer>",
      "<script>(" + offlineApp.toString() + ")(" + dataJson + ", " + lJson + ");</script>",
      "</body></html>"
    ].join("\n");
  }

  saveLocalBtn.addEventListener("click", function () {
    if (!currentLines.length || saveLocalBtn.disabled) return;
    stopAll();
    saveLocalBtn.disabled = true;
    saveLocalBtn.textContent = tr().saveLocalBtnLoading;

    var speed = currentSpeed;
    var tasks = currentLines.map(function (line) {
      return fetchLineAudio(line, speed).catch(function () { return null; });
    });

    Promise.all(tasks).then(function (results) {
      var title = titleInput.value.trim() || firstLineTitle(textarea.value);
      var html = buildOfflineDoc(title, currentLines, results, speed);
      var blob = new Blob([html], { type: "text/html" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = slugify(title) + ".html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      saveLocalBtn.textContent = tr().saveLocalBtn;
      saveLocalBtn.disabled = false;
    });
  });

  // ---- Interface language chrome ----

  function applyLocale() {
    var s = tr();
    document.documentElement.lang = currentLocale;

    txtTagline.textContent = s.tagline;
    txtYourText.textContent = s.yourText;
    txtParagraphLabel.textContent = s.paragraphLabel;
    txtTitleLabel.textContent = s.titleLabel;
    titleInput.placeholder = s.titlePlaceholder;
    saveBtn.textContent = s.saveBtn;
    saveLocalBtn.textContent = saveLocalBtn.disabled ? s.saveLocalBtnLoading : s.saveLocalBtn;
    analyzeBtn.textContent = analyzeBtn.disabled ? s.analyzeBtnLoading : s.analyzeBtn;
    txtTrySample.textContent = s.trySample;
    txtSavedParagraphs.textContent = s.savedParagraphs;
    txtSpeedLabel.textContent = s.speedToggleLabel;
    speedToggleEl.setAttribute("aria-label", s.speedToggleLabel);

    Array.prototype.forEach.call(langToggleEl.children, function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.locale === currentLocale ? "true" : "false");
    });

    if (lastRender) {
      render(lastRender.langKey, lastRender.lines, lastRender.isDraft, lastRender.confidence);
    }
    loadSavedParagraphs();
  }

  Array.prototype.forEach.call(langToggleEl.children, function (btn) {
    btn.addEventListener("click", function () {
      var loc = btn.dataset.locale;
      if (loc === currentLocale) return;
      currentLocale = loc;
      try { localStorage.setItem("prosody-locale", currentLocale); } catch (e) { /* ignore */ }
      applyLocale();
    });
  });

  // ---- Boot ----

  fetch("api/tts/status")
    .then(function (r) { return r.json(); })
    .then(function (d) { ttsConfigured = Boolean(d.configured); })
    .catch(function () { ttsConfigured = false; });

  renderSpeedToggle();
  applyLocale();

  // A /p/:id URL (from Save, from clicking a saved item, or a shared link)
  // loads that specific saved paragraph instead of the default sample.
  // Matched against the end of the path (not anchored at "^") so it works
  // whether the app is served at its own root or mounted under a base path.
  var pathMatch = window.location.pathname.match(/\/p\/(\d+)$/);
  if (pathMatch) {
    fetch("api/paragraphs/" + pathMatch[1])
      .then(function (r) { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then(function (item) { loadParagraph(item); })
      .catch(function () {
        textarea.value = SAMPLES.en.lines.map(function (l) { return l.text; }).join("\n");
        analyze();
      });
  } else {
    textarea.value = SAMPLES.en.lines.map(function (l) { return l.text; }).join("\n");
    analyze();
  }

  window.addEventListener("popstate", function () {
    // Simplest correct way to reflect back/forward navigation between
    // saved-paragraph URLs: just reload into the boot logic above.
    window.location.reload();
  });

  // Caches the app shell (this page, styles.css, app.js) so the tool still
  // opens without a network connection. API calls (paragraphs, TTS,
  // phonemize) still need to be online -- see sw.js.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* ignore */ });
    });
  }

})();
