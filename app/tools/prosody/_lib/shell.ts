// The Prosody app shell: same markup as little_translator/public/index.html,
// served as raw HTML (not a React page) so the original app.js/styles.css
// run unmodified against relative "api/..." paths under /tools/prosody/.
export const PROSODY_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/tools/prosody/">
<title>Prosody</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Source+Sans+3:wght@400;500;600;700&family=Gentium+Plus:ital@0;1&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body>

<header class="top">
  <div>
    <div class="wordmark-row">
      <span class="wordmark">Prosody</span>
      <span class="waveform" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>
    <p class="tagline" id="txt-tagline"></p>
  </div>
  <div class="lang-toggle" id="lang-toggle" role="group" aria-label="Interface language / 界面语言">
    <button type="button" data-locale="en">EN</button>
    <button type="button" data-locale="zh">中文</button>
  </div>
</header>

<div class="layout">
  <aside>
    <div>
      <div class="field-label" id="txt-saved-paragraphs" style="margin-bottom:8px;"></div>
      <div class="saved-list" id="saved-list"></div>
    </div>

    <div>
      <h2 id="txt-your-text"></h2>
    </div>
    <div>
      <label class="field-label" for="input-text" id="txt-paragraph-label"></label><br>
      <textarea id="input-text" spellcheck="false"></textarea>
    </div>
    <div>
      <label class="field-label" for="title-input" id="txt-title-label"></label><br>
      <input type="text" id="title-input" class="title-input" autocomplete="off">
    </div>
    <div class="save-row">
      <button class="btn btn-primary" id="analyze-btn"></button>
    </div>
    <div class="save-row">
      <button class="btn btn-ghost" id="save-btn"></button>
      <button class="btn btn-ghost" id="save-local-btn"></button>
    </div>
    <div class="save-status" id="save-status"></div>

    <div>
      <div class="field-label" id="txt-try-sample" style="margin-bottom:8px;"></div>
      <div class="chips" id="sample-chips"></div>
    </div>

  </aside>

  <section class="results">
    <div class="results-bar">
      <div class="detected" id="detected-pill">
        <span class="dot"></span>
        <span id="detected-text">—</span>
      </div>
      <div class="results-actions">
        <span class="speed-label" id="txt-speed-label"></span>
        <div class="speed-toggle" id="speed-toggle" role="group"></div>
        <button class="btn btn-ghost" id="read-all-btn"></button>
      </div>
    </div>
    <div id="tts-note" class="tts-note" hidden></div>
    <div id="draft-note" class="draft-note" hidden></div>
    <div class="lines" id="lines"></div>
  </section>
</div>

<script src="app.js"></script>
</body>
</html>
`;

export function renderProsodyShell(): Response {
  return new Response(PROSODY_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
