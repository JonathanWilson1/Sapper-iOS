// SAPPER — share.js
// Replay capture, the animated GIF encoder and the share card.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- replay capture: the last ~6 seconds, for the animated share card
const GIF_W = 720,
  GIF_H = 900,
  GIF_TOP = 580,
  CAP_N = 40;
const capRing = [];
let capHead = 0,
  capCount = 0,
  lastFocusY = null;
function captureFrame() {
  // one sample per world cell: tiny to store, and scaled back up with hard edges it stays crisp pixel art
  const cw = Math.round(cv.width / scale) - 1,
    ch = Math.round((cw * GIF_TOP) / GIF_W); // one cell narrower than the screen so every column is a whole cell
  if (!capRing.length) for (let k = 0; k < CAP_N; k++) capRing.push(document.createElement('canvas'));
  const c = capRing[capHead];
  if (c.width !== cw || c.height !== ch) {
    c.width = cw;
    c.height = ch;
  }
  const x = c.getContext('2d');
  // aim at the action: the latest big blast if there is one, otherwise the nearest generator
  let fy = null;
  for (const f of flashes) if (f.r > 20) fy = f.y;
  if (fy === null) {
    const mid = cam.y + viewRows() * 0.4;
    let bd = 1e9;
    for (const gn of gens) {
      const d = Math.abs(gn.y - mid);
      if (d < bd) {
        bd = d;
        fy = gn.y + 3;
      }
    }
  }
  // ease the aim so the replay doesn't jump between targets
  if (fy !== null) lastFocusY = lastFocusY === null ? fy : lastFocusY + (fy - lastFocusY) * 0.2;
  const sh2 = ch * scale,
    cy = lastFocusY === null ? cv.height * 0.38 : (lastFocusY - cam.y) * scale;
  let sy = Math.max(0, Math.min(cv.height - trayPx - sh2, cy - sh2 * 0.45));
  // snap the crop to the world's cell grid and sample each cell at its centre, so pixels don't shimmer frame to frame
  const ox = (((-cam.x % 1) + 1) % 1) * scale,
    oy = (((-cam.y % 1) + 1) % 1) * scale;
  sy = oy + Math.round((sy - oy) / scale) * scale;
  x.imageSmoothingEnabled = false;
  x.drawImage(cv, ox + scale / 2, sy + scale / 2, cw * scale, sh2, 0, 0, cw, ch);
  capHead = (capHead + 1) % CAP_N;
  capCount = Math.min(CAP_N, capCount + 1);
}
function resetCapture() {
  capHead = 0;
  capCount = 0;
  lastFocusY = null;
}

// GIF89a encoder (LZW). The 256-colour palette is built from the replay itself: the most common colours
// (pixel art uses few) plus the card's text colours, so the dirt and rock keep their real tones.
let GIF_PAL = [],
  GIF_LUT = null;
function gifBuildPalette(hist) {
  const bins = [];
  for (let i = 0; i < 32768; i++) if (hist[i]) bins.push(i);
  bins.sort((a, b) => hist[b] - hist[a]);
  GIF_PAL = ['#0d0a07', '#f0d68a', '#cdb98a', '#e6bf4a', '#d8c9a3', '#8a7a5a'].map(h => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);
  for (const i of bins) {
    if (GIF_PAL.length >= 256) break;
    GIF_PAL.push([(i >> 10) * 8 + 4, ((i >> 5) & 31) * 8 + 4, (i & 31) * 8 + 4]);
  }
  GIF_LUT = null;
}
function gifLut() {
  if (GIF_LUT) return GIF_LUT;
  GIF_LUT = new Uint8Array(32768);
  for (let i = 0; i < 32768; i++) {
    const r = (i >> 10) * 8 + 4,
      g2 = ((i >> 5) & 31) * 8 + 4,
      b = (i & 31) * 8 + 4;
    let best = 0,
      bd = 1e9;
    for (let k = 0; k < GIF_PAL.length; k++) {
      const c = GIF_PAL[k],
        d = (c[0] - r) ** 2 + (c[1] - g2) ** 2 + (c[2] - b) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    GIF_LUT[i] = best;
  }
  return GIF_LUT;
}
function gifIndex(data) {
  const lut = gifLut(),
    n = data.length >> 2,
    out = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4)
    out[i] = lut[((data[j] >> 3) << 10) | ((data[j + 1] >> 3) << 5) | (data[j + 2] >> 3)];
  return out;
}
function GifWriter() {
  let buf = new Uint8Array(1 << 20),
    n = 0;
  const byte = v => {
    if (n >= buf.length) {
      const b = new Uint8Array(buf.length * 2);
      b.set(buf);
      buf = b;
    }
    buf[n++] = v;
  };
  return {
    byte,
    u16: v => {
      byte(v & 255);
      byte((v >> 8) & 255);
    },
    str: s2 => {
      for (const ch of s2) byte(ch.charCodeAt(0));
    },
    bytes: () => buf.subarray(0, n),
  };
}
function gifLzw(w, px) {
  const min = 8,
    clear = 256,
    eoi = 257;
  let size = 9,
    next = 258,
    cur = 0,
    bits = 0;
  const table = new Map(),
    block = [];
  const emit = code => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) {
      block.push(cur & 255);
      cur >>>= 8;
      bits -= 8;
      if (block.length === 255) {
        w.byte(255);
        for (const b of block) w.byte(b);
        block.length = 0;
      }
    }
  };
  w.byte(min);
  emit(clear);
  let prefix = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i],
      key = prefix * 256 + k,
      c = table.get(key);
    if (c !== undefined) {
      prefix = c;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      table.clear();
      size = 9;
      next = 258;
    } else {
      if (next >= 1 << size) size++;
      table.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) block.push(cur & 255);
  if (block.length) {
    w.byte(block.length);
    for (const b of block) w.byte(b);
  }
  w.byte(0);
}
function gifStart(w, width, height) {
  w.str('GIF89a');
  w.u16(width);
  w.u16(height);
  w.byte(0xf7);
  w.byte(0);
  w.byte(0);
  for (let k = 0; k < 256; k++) {
    const c = GIF_PAL[k] || [0, 0, 0];
    w.byte(c[0]);
    w.byte(c[1]);
    w.byte(c[2]);
  }
  w.byte(0x21);
  w.byte(0xff);
  w.byte(11);
  w.str('NETSCAPE2.0');
  w.byte(3);
  w.byte(1);
  w.u16(0);
  w.byte(0); // loop forever
}
function gifFrame(w, width, height, px, delayCs) {
  w.byte(0x21);
  w.byte(0xf9);
  w.byte(4);
  w.byte(0);
  w.u16(delayCs);
  w.byte(0);
  w.byte(0);
  w.byte(0x2c);
  w.u16(0);
  w.u16(0);
  w.u16(width);
  w.u16(height);
  w.byte(0);
  gifLzw(w, px);
}
// the static parts of the card: title band on top, stats panel below the replay
function drawCardOverlay(x, sc, t) {
  const mono = 'ui-monospace,Menlo,"Courier New",monospace',
    k = GIF_W / 360,
    T = GIF_TOP;
  const tg = x.createLinearGradient(0, 0, 0, 90 * k);
  tg.addColorStop(0, '#0d0a07ee');
  tg.addColorStop(1, '#0d0a0700');
  x.fillStyle = tg;
  x.fillRect(0, 0, GIF_W, 90 * k);
  x.imageSmoothingEnabled = false;
  x.drawImage($('title'), 0, 0, 96, 26, GIF_W / 2 - 96 * k, 12 * k, 192 * k, 52 * k);
  const gr = x.createLinearGradient(0, T - 60 * k, 0, T);
  gr.addColorStop(0, '#0d0a0700');
  gr.addColorStop(1, '#0d0a07');
  x.fillStyle = gr;
  x.fillRect(0, T - 60 * k, GIF_W, 60 * k);
  x.fillStyle = '#0d0a07';
  x.fillRect(0, T, GIF_W, GIF_H - T);
  if (game.daily) {
    x.textAlign = 'center';
    x.fillStyle = '#f0d68a';
    x.font = `800 ${12 * k}px ${mono}`;
    x.fillText(`DAILY CHALLENGE · ${todayLabel()}`, GIF_W / 2, 76 * k);
  }
  x.textAlign = 'center';
  x.fillStyle = '#cdb98a';
  x.font = `700 ${13 * k}px ${mono}`;
  x.fillText('I HELD THE LINE FOR', GIF_W / 2, T + 10 * k);
  x.fillStyle = '#f0d68a';
  x.font = `900 ${40 * k}px ${mono}`;
  x.fillText(fmtT(t), GIF_W / 2, T + 48 * k);
  x.fillStyle = '#e6bf4a';
  x.font = `900 ${20 * k}px ${mono}`;
  x.fillText(`SCORE ${sc.toLocaleString()}`, GIF_W / 2, T + 76 * k);
  x.font = `800 ${13 * k}px ${mono}`;
  x.fillStyle = '#d8c9a3';
  x.fillText(
    `${game.meteors || 0} METEORS · ${game.raids || 0} RAIDS · ${game.kills || 0} RAIDERS DOWN`,
    GIF_W / 2,
    T + 102 * k
  );
  x.fillStyle = '#cdb98a';
  x.font = `800 ${13 * k}px ${mono}`;
  x.fillText('CAN YOU HOLD THE LINE?', GIF_W / 2, T + 130 * k);
  x.fillStyle = '#8a7a5a';
  x.font = `700 ${11 * k}px ${mono}`;
  x.fillText(SHARE_URL.replace('https://', ''), GIF_W / 2, T + 150 * k);
}
let gifBlob = null,
  gifJob = 0,
  capThis = false,
  lastCapAt = 0;
function buildShareGif(sc, t) {
  const job = ++gifJob;
  gifBlob = null;
  const n = capCount;
  if (n < 4) return;
  const order = [];
  for (let k = 0; k < n; k++) order.push(capRing[(capHead - n + k + CAP_N) % CAP_N]);
  const comp = document.createElement('canvas');
  comp.width = GIF_W;
  comp.height = GIF_H;
  const x = comp.getContext('2d', { willReadFrequently: true });
  const overlay = document.createElement('canvas');
  overlay.width = GIF_W;
  overlay.height = GIF_H;
  drawCardOverlay(overlay.getContext('2d'), sc, t);
  x.imageSmoothingEnabled = false;
  const compose = f => {
    x.fillStyle = '#0d0a07';
    x.fillRect(0, 0, GIF_W, GIF_H);
    x.drawImage(f, 0, 0, f.width, f.height, 0, 0, GIF_W, GIF_TOP);
    x.drawImage(overlay, 0, 0);
    return x.getImageData(0, 0, GIF_W, GIF_H).data;
  };
  // pass 1: colour histogram over a sample of every frame
  const hist = new Uint32Array(32768);
  for (let q = 0; q < order.length; q += 2) {
    const d = compose(order[q]);
    for (let j = 0; j < d.length; j += 12)
      hist[((d[j] >> 3) << 10) | ((d[j + 1] >> 3) << 5) | (d[j + 2] >> 3)]++;
  }
  gifBuildPalette(hist);
  const w = GifWriter();
  gifStart(w, GIF_W, GIF_H);
  const btn = $('shareBtn');
  let k = 0;
  const step = () => {
    if (job !== gifJob) return;
    gifFrame(w, GIF_W, GIF_H, gifIndex(compose(order[k])), k === order.length - 1 ? 250 : 12);
    k++;
    btn.textContent = `Making GIF… ${Math.round((k / order.length) * 100)}%`;
    if (k < order.length) setTimeout(step, 0);
    else {
      w.byte(0x3b);
      gifBlob = new Blob([w.bytes()], { type: 'image/gif' });
      $('sharePreview').src = URL.createObjectURL(gifBlob);
      btn.textContent = 'Share My Score';
    }
  };
  setTimeout(step, 50);
}

// ---------- share card: an image + text for Signal, WhatsApp, etc.
const SHARE_URL = 'https://jonathanwilson1.github.io/Sapper-iOS/';
let shareBlob = null,
  shareText = '',
  shareCardUrl = '';
function buildShareCard(snap, sc, t) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const x = c.getContext('2d');
  x.fillStyle = '#0d0a07';
  x.fillRect(0, 0, 1080, 1350);
  // the moment the line fell, cropped to fill the top
  const h = 760,
    r = Math.max(1080 / snap.width, h / snap.height),
    sw = 1080 / r,
    sh2 = h / r;
  x.imageSmoothingEnabled = false;
  x.drawImage(snap, (snap.width - sw) / 2, Math.max(0, (snap.height - sh2) * 0.35), sw, sh2, 0, 0, 1080, h);
  const gr = x.createLinearGradient(0, h - 260, 0, h);
  gr.addColorStop(0, '#0d0a0700');
  gr.addColorStop(1, '#0d0a07');
  x.fillStyle = gr;
  x.fillRect(0, h - 260, 1080, 260);
  const tg = x.createLinearGradient(0, 0, 0, 260);
  tg.addColorStop(0, '#0d0a07ee');
  tg.addColorStop(1, '#0d0a0700');
  x.fillStyle = tg;
  x.fillRect(0, 0, 1080, 260);
  x.drawImage($('title'), 0, 0, 96, 26, 204, 40, 96 * 7, 26 * 7);
  x.fillStyle = '#0008';
  x.fillRect(0, 0, 1080, 6);
  const mono = 'ui-monospace,Menlo,"Courier New",monospace';
  x.textAlign = 'center';
  x.fillStyle = '#cdb98a';
  x.font = `700 34px ${mono}`;
  x.fillText('I HELD THE LINE FOR', 540, 800);
  x.fillStyle = '#f0d68a';
  x.font = `900 120px ${mono}`;
  x.fillText(fmtT(t), 540, 920);
  x.fillStyle = '#e6bf4a';
  x.font = `900 56px ${mono}`;
  x.fillText(`SCORE ${sc.toLocaleString()}`, 540, 1000);
  const rows = [
    [game.meteors, 'METEOR STRIKES SURVIVED'],
    [game.raids, 'WAVES OF RAIDERS'],
    [game.barrages, 'ARTILLERY BARRAGES'],
    [game.kills, 'RAIDERS STOPPED'],
  ];
  for (let k = 0; k < rows.length; k++) rows[k][0] = rows[k][0] || 0;
  x.font = `800 34px ${mono}`;
  rows.forEach(([n, l], k) => {
    const yy = 1060 + k * 46;
    x.textAlign = 'right';
    x.fillStyle = '#f0d68a';
    x.fillText(String(n), 330, yy);
    x.textAlign = 'left';
    x.fillStyle = '#d8c9a3';
    x.fillText(l, 360, yy);
  });
  x.textAlign = 'center';
  x.fillStyle = '#cdb98a';
  x.font = `800 32px ${mono}`;
  x.fillText('CAN YOU HOLD THE LINE?', 540, 1285);
  x.fillStyle = '#8a7a5a';
  x.font = `700 26px ${mono}`;
  x.fillText(SHARE_URL.replace('https://', ''), 540, 1325);
  shareText =
    (game.daily ? `SAPPER daily challenge (${todayLabel()}): ` : '') +
    `I held the line for ${fmtT(t)} in SAPPER — survived ${game.meteors} meteor strike${game.meteors === 1 ? '' : 's'} and ${game.raids} wave${game.raids === 1 ? '' : 's'} of raiders. Score ${sc.toLocaleString()}. Can you beat it? ${SHARE_URL}`;
  shareCardUrl = c.toDataURL('image/png');
  $('sharePreview').src = shareCardUrl;
  shareBlob = null;
  c.toBlob(b => {
    shareBlob = b;
  }, 'image/png');
}
async function shareScore() {
  const usingGif = !!gifBlob,
    blob = gifBlob || shareBlob,
    name = usingGif ? 'sapper-score.gif' : 'sapper-score.png';
  const dataUrl = usingGif
    ? await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(gifBlob);
      })
    : shareCardUrl;
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.share) {
      window.webkit.messageHandlers.share.postMessage({ image: dataUrl, text: shareText });
      return;
    }
  } catch (e) {}
  const file = blob && new File([blob], name, { type: usingGif ? 'image/gif' : 'image/png' });
  try {
    // iOS hands apps like Signal only the text when a share has both, so share the image alone (it carries the link)
    // and put the caption on the clipboard to paste alongside it
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.clipboard &&
        navigator.clipboard.writeText(shareText).then(
          () => toast('Caption copied — paste it with the image'),
          () => {}
        );
      await navigator.share({ files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ text: shareText });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
  try {
    await navigator.clipboard.writeText(shareText);
    toast('Image saved, score text copied');
  } catch (e) {}
}
