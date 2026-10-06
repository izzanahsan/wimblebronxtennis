/**
 * Tennis Session Story Renderer for Instagram Stories (1080x1920)
 * Renders session results, podiums, standings, and match scores.
 */

// Draw rounded rectangle path without relying on native ctx.roundRect
function roundRect(ctx, x, y, width, height, radius = 0) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Center-crop "cover" draw of an image onto a target rectangle
function coverDraw(ctx, img, targetW, targetH) {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  if (!imgW || !imgH) return;
  const scale = Math.max(targetW / imgW, targetH / imgH);
  const sw = targetW / scale;
  const sh = targetH / scale;
  const sx = (imgW - sw) / 2;
  const sy = (imgH - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
}

// Truncate text with ellipsis if it exceeds maxWidth
function fitText(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let low = 0;
  let high = text.length;
  let result = '';
  while (low <= high) {
    const mid = (low + high) >> 1;
    const test = text.slice(0, mid) + ellipsis;
    if (ctx.measureText(test).width <= maxWidth) {
      result = test;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result || ellipsis;
}

// Draw tennis court lines pattern on default purple background
function drawCourtLines(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 3;

  const bx = 130, by = 250, bw = 820, bh = 1420;
  ctx.strokeRect(bx, by, bw, bh);

  const sx = bx + 85, sw = bw - 170;
  ctx.strokeRect(sx, by, sw, bh);

  const netY = by + bh / 2;
  ctx.beginPath();
  ctx.moveTo(bx - 30, netY);
  ctx.lineTo(bx + bw + 30, netY);
  ctx.stroke();

  const serviceDist = 320;
  ctx.beginPath();
  ctx.moveTo(sx, netY - serviceDist);
  ctx.lineTo(sx + sw, netY - serviceDist);
  ctx.moveTo(sx, netY + serviceDist);
  ctx.lineTo(sx + sw, netY + serviceDist);
  ctx.stroke();

  const midX = bx + bw / 2;
  ctx.beginPath();
  ctx.moveTo(midX, netY - serviceDist);
  ctx.lineTo(midX, netY + serviceDist);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(midX, by);
  ctx.lineTo(midX, by + 26);
  ctx.moveTo(midX, by + bh);
  ctx.lineTo(midX, by + bh - 26);
  ctx.stroke();
  ctx.restore();
}

/**
 * Load HTMLImageElement from a local file object (supports JPG/PNG)
 */
async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Could not read this photo — try a JPG or PNG'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this photo — try a JPG or PNG'));
    };
    img.src = url;
  });
}

/**
 * Native share or file download trigger
 */
async function shareOrDownload(blob, filename = 'story.png') {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.code === 20)) {
        return 'cancelled';
      }
      return 'cancelled';
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    return 'downloaded';
  } catch (_) {
    return 'cancelled';
  }
}

/**
 * Render names-only podium cards
 */
function renderPodium(ctx, rawPodium, startY, s) {
  const count = Math.min(3, rawPodium.length);
  if (count === 0) return 0;

  const w1 = Math.round(300 * s);
  const w2 = Math.round(270 * s);
  const w3 = Math.round(270 * s);
  const gap = Math.round(24 * s);

  const h1 = Math.round(190 * s);
  const h2 = Math.round(165 * s);
  const h3 = Math.round(155 * s);

  const dy1 = 0;
  const dy2 = Math.round(25 * s);
  const dy3 = Math.round(35 * s);

  let configs = [];
  if (count === 3) {
    const totalW = w2 + gap + w1 + gap + w3;
    const startX = Math.round((1080 - totalW) / 2);
    configs = [
      { item: rawPodium[1], rank: '2', color: '#C0C0C0', x: startX, y: startY + dy2, w: w2, h: h2 },
      { item: rawPodium[0], rank: '1', color: '#FFD700', x: startX + w2 + gap, y: startY + dy1, w: w1, h: h1 },
      { item: rawPodium[2], rank: '3', color: '#CD7F32', x: startX + w2 + gap + w1 + gap, y: startY + dy3, w: w3, h: h3 }
    ];
  } else if (count === 2) {
    const totalW = w2 + gap + w1;
    const startX = Math.round((1080 - totalW) / 2);
    configs = [
      { item: rawPodium[1], rank: '2', color: '#C0C0C0', x: startX, y: startY + dy2, w: w2, h: h2 },
      { item: rawPodium[0], rank: '1', color: '#FFD700', x: startX + w2 + gap, y: startY + dy1, w: w1, h: h1 }
    ];
  } else if (count === 1) {
    const startX = Math.round((1080 - w1) / 2);
    configs = [
      { item: rawPodium[0], rank: '1', color: '#FFD700', x: startX, y: startY + dy1, w: w1, h: h1 }
    ];
  }

  const radius = Math.round(12 * s);

  for (const cfg of configs) {
    if (!cfg.item) continue;

    // Card background & border
    ctx.save();
    roundRect(ctx, cfg.x, cfg.y, cfg.w, cfg.h, radius);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    // 4px top accent bar
    roundRect(ctx, cfg.x, cfg.y, cfg.w, cfg.h, radius);
    ctx.clip();
    ctx.fillStyle = cfg.color;
    ctx.fillRect(cfg.x, cfg.y, cfg.w, 4);
    ctx.restore();

    // Card content
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const numY = cfg.y + Math.round(cfg.h * 0.27);
    const nameY = cfg.y + Math.round(cfg.h * 0.58);
    const valY = cfg.y + Math.round(cfg.h * 0.83);

    const numSize = cfg.rank === '1' ? Math.round(52 * s) : Math.round(46 * s);
    const nameSize = Math.round(32 * s);
    const valSize = Math.round(32 * s);

    // Big rank numeral
    ctx.fillStyle = cfg.color;
    ctx.font = `${numSize}px "Bebas Neue", sans-serif`;
    ctx.fillText(cfg.rank, cfg.x + cfg.w / 2, numY);

    // Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `600 ${nameSize}px "DM Sans", sans-serif`;
    ctx.fillText(fitText(ctx, cfg.item.name || '', cfg.w - Math.round(24 * s)), cfg.x + cfg.w / 2, nameY);

    // Value
    if (cfg.item.value) {
      ctx.fillStyle = cfg.color;
      ctx.font = `${valSize}px "Bebas Neue", sans-serif`;
      ctx.fillText(fitText(ctx, String(cfg.item.value), cfg.w - Math.round(24 * s)), cfg.x + cfg.w / 2, valY);
    }
    ctx.restore();
  }

  return h1;
}

/**
 * Render standings rows section
 */
function renderStandings(ctx, rawRows, startY, scale, maxCount, accent) {
  const headerH = Math.round(36 * scale);
  ctx.fillStyle = accent;
  ctx.font = `${Math.round(26 * scale)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('STANDINGS', 64, startY + headerH / 2);

  const titleW = ctx.measureText('STANDINGS').width;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(64 + titleW + 16, startY + headerH / 2);
  ctx.lineTo(1016, startY + headerH / 2);
  ctx.stroke();

  const currentY = startY + headerH;
  const slotH = Math.round(52 * scale);
  const rowItemH = slotH - Math.round(6 * scale);
  const displayedCount = Math.min(maxCount, rawRows.length);
  const hasOverflow = rawRows.length > displayedCount;

  for (let i = 0; i < displayedCount; i++) {
    const row = rawRows[i];
    const rowY = currentY + i * slotH;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, 64, rowY, 952, rowItemH, 10);
    ctx.fill();
    ctx.stroke();

    const rankColor = row.rank === 1 ? '#FFD700' : row.rank === 2 ? '#C0C0C0' : row.rank === 3 ? '#CD7F32' : 'rgba(255, 255, 255, 0.7)';
    ctx.fillStyle = rankColor;
    ctx.font = `${Math.round(28 * scale)}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(row.rank), 98, rowY + rowItemH / 2);

    ctx.fillStyle = accent;
    ctx.font = `${Math.round(30 * scale)}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(row.value, 996, rowY + rowItemH / 2);
    const valWidth = ctx.measureText(row.value).width;

    const startX = 136;
    const availableW = 996 - valWidth - 20 - startX;
    ctx.textAlign = 'left';

    if (row.sub) {
      ctx.font = `400 ${Math.round(19 * scale)}px "DM Sans", sans-serif`;
      const subW = ctx.measureText(row.sub).width;
      const nameW = Math.max(80, availableW - subW - 14);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 ${Math.round(25 * scale)}px "DM Sans", sans-serif`;
      const nameText = fitText(ctx, row.name, nameW);
      ctx.fillText(nameText, startX, rowY + rowItemH / 2);

      const actualNameW = ctx.measureText(nameText).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = `400 ${Math.round(19 * scale)}px "DM Sans", sans-serif`;
      ctx.fillText(row.sub, startX + actualNameW + 12, rowY + rowItemH / 2);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 ${Math.round(25 * scale)}px "DM Sans", sans-serif`;
      ctx.fillText(fitText(ctx, row.name, availableW), startX, rowY + rowItemH / 2);
    }
  }

  if (hasOverflow) {
    const moreY = currentY + displayedCount * slotH;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    roundRect(ctx, 64, moreY, 952, rowItemH, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `500 ${Math.round(23 * scale)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${rawRows.length - displayedCount} more`, 540, moreY + rowItemH / 2);
  }

  const totalSlots = displayedCount + (hasOverflow ? 1 : 0);
  return headerH + totalSlots * slotH;
}

/**
 * Render matches list section
 */
function renderMatches(ctx, rawMatches, startY, scale, maxCount, accent) {
  const headerH = Math.round(36 * scale);
  ctx.fillStyle = accent;
  ctx.font = `${Math.round(26 * scale)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('MATCH RESULTS', 64, startY + headerH / 2);

  const titleW = ctx.measureText('MATCH RESULTS').width;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(64 + titleW + 16, startY + headerH / 2);
  ctx.lineTo(1016, startY + headerH / 2);
  ctx.stroke();

  const currentY = startY + headerH;
  const slotH = Math.round(48 * scale);
  const matchItemH = slotH - Math.round(6 * scale);
  const displayedCount = Math.min(maxCount, rawMatches.length);
  const hasOverflow = rawMatches.length > displayedCount;

  for (let i = 0; i < displayedCount; i++) {
    const m = rawMatches[i];
    const matchY = currentY + i * slotH;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    roundRect(ctx, 64, matchY, 952, matchItemH, 10);
    ctx.fill();
    ctx.stroke();

    const aWon = m.sa !== null && m.sa !== undefined && m.sb !== null && m.sb !== undefined && m.sa > m.sb;
    const bWon = m.sa !== null && m.sa !== undefined && m.sb !== null && m.sb !== undefined && m.sb > m.sa;

    let labelOffset = 0;
    if (m.label) {
      labelOffset = Math.round(130 * scale);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = `500 ${Math.round(18 * scale)}px "DM Sans", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitText(ctx, m.label, labelOffset - 12), 82, matchY + matchItemH / 2);
    }

    const pillW = Math.round(86 * scale);
    const pillH = Math.round(30 * scale);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(ctx, 540 - pillW / 2, matchY + (matchItemH - pillH) / 2, pillW, pillH, 6);
    ctx.fill();

    const scoreText = `${m.sa !== null && m.sa !== undefined ? m.sa : '-'} : ${m.sb !== null && m.sb !== undefined ? m.sb : '-'}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${Math.round(25 * scale)}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(scoreText, 540, matchY + matchItemH / 2);

    const leftBoundary = 64 + (labelOffset > 0 ? labelOffset + 16 : 20);
    const rightBoundaryA = 540 - pillW / 2 - Math.round(14 * scale);
    const maxWA = Math.max(60, rightBoundaryA - leftBoundary);

    ctx.textAlign = 'right';
    ctx.fillStyle = aWon ? accent : bWon ? 'rgba(255, 255, 255, 0.45)' : '#FFFFFF';
    ctx.font = `${aWon ? '700' : '500'} ${Math.round(24 * scale)}px "DM Sans", sans-serif`;
    ctx.fillText(fitText(ctx, m.a, maxWA), rightBoundaryA, matchY + matchItemH / 2);

    const leftBoundaryB = 540 + pillW / 2 + Math.round(14 * scale);
    const maxWB = Math.max(60, 1016 - 20 - leftBoundaryB);

    ctx.textAlign = 'left';
    ctx.fillStyle = bWon ? accent : aWon ? 'rgba(255, 255, 255, 0.45)' : '#FFFFFF';
    ctx.font = `${bWon ? '700' : '500'} ${Math.round(24 * scale)}px "DM Sans", sans-serif`;
    ctx.fillText(fitText(ctx, m.b, maxWB), leftBoundaryB, matchY + matchItemH / 2);
  }

  if (hasOverflow) {
    const moreY = currentY + displayedCount * slotH;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    roundRect(ctx, 64, moreY, 952, matchItemH, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `500 ${Math.round(23 * scale)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${rawMatches.length - displayedCount} more matches`, 540, moreY + matchItemH / 2);
  }

  const totalSlots = displayedCount + (hasOverflow ? 1 : 0);
  return headerH + totalSlots * slotH;
}

/**
 * Render story image (1080x1920 PNG Blob)
 */
async function renderStory(opts = {}) {
  try {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      await document.fonts.load('80px "Bebas Neue"');
      await document.fonts.load('600 40px "DM Sans"');
    }
  } catch (_) {}

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  const title = opts.title || '';
  const subtitle = opts.subtitle || '';
  const accent = opts.accent || '#4ADE80';
  const footerText = opts.footer !== undefined ? opts.footer : 'wimblebronx';
  const layout = opts.layout === 'photo' ? 'photo' : 'full';
  const sectionsOrder = opts.sections || ['podium', 'rows', 'matches'];

  // Background rendering
  if (opts.photo) {
    coverDraw(ctx, opts.photo, 1080, 1920);
    const darkGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    if (layout === 'photo') {
      darkGrad.addColorStop(0, 'rgba(0, 0, 0, 0.70)');
      darkGrad.addColorStop(0.30, 'rgba(0, 0, 0, 0.45)');
      darkGrad.addColorStop(0.36, 'rgba(0, 0, 0, 0.08)');
      darkGrad.addColorStop(0.62, 'rgba(0, 0, 0, 0.08)');
      darkGrad.addColorStop(0.70, 'rgba(0, 0, 0, 0.70)');
      darkGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
    } else {
      darkGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      darkGrad.addColorStop(0.24, 'rgba(0, 0, 0, 0.45)');
      darkGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.76)');
      darkGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
    }
    ctx.fillStyle = darkGrad;
    ctx.fillRect(0, 0, 1080, 1920);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGrad.addColorStop(0, '#3B0764');
    bgGrad.addColorStop(1, '#0D0118');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);
    drawCourtLines(ctx);
  }

  // Header (y=236, safely within safe zones)
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '86px "Bebas Neue", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(fitText(ctx, title, 952), 64, 236);

  let headerBottomY = 236 + 90;
  if (subtitle) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.font = '500 28px "DM Sans", sans-serif';
    ctx.fillText(fitText(ctx, subtitle, 952), 64, 326);
    headerBottomY = 326 + 38;
  }
  ctx.restore();

  // Footer (y ≈ 1840)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '500 24px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(footerText, 540, 1840);

  const rawPodium = Array.isArray(opts.podium) ? opts.podium.slice(0, 3) : [];
  const rawRows = Array.isArray(opts.rows) ? opts.rows : [];
  const rawMatches = Array.isArray(opts.matches) ? opts.matches : [];

  const hasPodium = sectionsOrder.includes('podium') && rawPodium.length > 0;
  const hasRows = sectionsOrder.includes('rows') && rawRows.length > 0;
  const hasMatches = sectionsOrder.includes('matches') && rawMatches.length > 0;

  if (layout === 'photo') {
    // Top band: compact podium scaled to ~70%
    if (hasPodium) {
      const podScale = 1.0;
      const podY = headerBottomY + 20;
      renderPodium(ctx, rawPodium, podY, podScale);
    }

    // Middle (to ~1230): clear

    // Bottom band (~1250 -> 1700): exactly one section (matches prioritized, else rows)
    const photoSectionKey = (sectionsOrder.includes('matches') && rawMatches.length > 0)
      ? 'matches'
      : (sectionsOrder.includes('rows') && rawRows.length > 0)
        ? 'rows'
        : null;

    if (photoSectionKey) {
      const availableH = 450;
      const minFont = 24;
      const baseFont = 32;
      const minScale = minFont / baseFont; // 0.75

      if (photoSectionKey === 'matches') {
        let maxMatches = Math.min(6, rawMatches.length);
        if (rawMatches.length > 6) maxMatches = 5;

        const measureMatchesH = (s, count) => {
          const slots = rawMatches.length <= count ? rawMatches.length : count + 1;
          return Math.round(36 * s) + slots * Math.round(48 * s);
        };

        while (measureMatchesH(minScale, maxMatches) > availableH && maxMatches > 1) {
          maxMatches--;
        }

        let scaleLow = minScale;
        let scaleHigh = 1.4;
        for (let iter = 0; iter < 12; iter++) {
          const mid = (scaleLow + scaleHigh) / 2;
          if (measureMatchesH(mid, maxMatches) <= availableH) {
            scaleLow = mid;
          } else {
            scaleHigh = mid;
          }
        }
        const scale = scaleLow;
        const totalH = measureMatchesH(scale, maxMatches);
        const startY = 1250 + Math.max(0, Math.floor((availableH - totalH) / 3));
        renderMatches(ctx, rawMatches, startY, scale, maxMatches, accent);
      } else if (photoSectionKey === 'rows') {
        let maxRows = Math.min(6, rawRows.length);
        if (rawRows.length > 6) maxRows = 5;

        const measureRowsH = (s, count) => {
          const slots = rawRows.length <= count ? rawRows.length : count + 1;
          return Math.round(36 * s) + slots * Math.round(52 * s);
        };

        while (measureRowsH(minScale, maxRows) > availableH && maxRows > 1) {
          maxRows--;
        }

        let scaleLow = minScale;
        let scaleHigh = 1.4;
        for (let iter = 0; iter < 12; iter++) {
          const mid = (scaleLow + scaleHigh) / 2;
          if (measureRowsH(mid, maxRows) <= availableH) {
            scaleLow = mid;
          } else {
            scaleHigh = mid;
          }
        }
        const scale = scaleLow;
        const totalH = measureRowsH(scale, maxRows);
        const startY = 1250 + Math.max(0, Math.floor((availableH - totalH) / 3));
        renderStandings(ctx, rawRows, startY, scale, maxRows, accent);
      }
    }
  } else {
    // Full layout
    const activeSectionKeys = sectionsOrder.filter((key) => {
      if (key === 'podium') return hasPodium;
      if (key === 'rows') return hasRows;
      if (key === 'matches') return hasMatches;
      return false;
    });

    const startContentY = 380;
    const endContentY = 1710;
    const totalAvailableH = endContentY - startContentY;

    const minFont = 26;
    const baseFont = 32;
    const minScale = minFont / baseFont;

    let maxRows = Math.min(10, rawRows.length);
    if (rawRows.length > 10) maxRows = 9;

    let maxMatches = Math.min(12, rawMatches.length);
    if (rawMatches.length > 12) maxMatches = 11;

    const sectionGapsTotal = Math.max(0, activeSectionKeys.length - 1) * 28;
    const netHeightBudget = totalAvailableH - sectionGapsTotal;

    const measureRequiredHeight = (s, rCount, mCount) => {
      let h = 0;
      for (const key of activeSectionKeys) {
        if (key === 'podium') {
          h += Math.round(190 * s);
        } else if (key === 'rows') {
          const slots = rawRows.length <= rCount ? rawRows.length : rCount + 1;
          h += Math.round(36 * s) + slots * Math.round(52 * s);
        } else if (key === 'matches') {
          const slots = rawMatches.length <= mCount ? rawMatches.length : mCount + 1;
          h += Math.round(36 * s) + slots * Math.round(48 * s);
        }
      }
      return h;
    };

    while (measureRequiredHeight(minScale, maxRows, maxMatches) > netHeightBudget) {
      if (hasMatches && maxMatches > 3 && (maxMatches >= maxRows || !hasRows || maxRows <= 3)) {
        maxMatches--;
      } else if (hasRows && maxRows > 3) {
        maxRows--;
      } else if (hasMatches && maxMatches > 1) {
        maxMatches--;
      } else if (hasRows && maxRows > 1) {
        maxRows--;
      } else {
        break;
      }
    }

    let scaleLow = minScale;
    let scaleHigh = 1.4;
    for (let iter = 0; iter < 12; iter++) {
      const mid = (scaleLow + scaleHigh) / 2;
      if (measureRequiredHeight(mid, maxRows, maxMatches) <= netHeightBudget) {
        scaleLow = mid;
      } else {
        scaleHigh = mid;
      }
    }
    const scale = scaleLow;

    const totalCalculatedH = measureRequiredHeight(scale, maxRows, maxMatches) + sectionGapsTotal;
    let currentY = startContentY + Math.max(0, Math.floor((netHeightBudget - totalCalculatedH) / 3));

    for (const key of activeSectionKeys) {
      if (key === 'podium') {
        const h = renderPodium(ctx, rawPodium, currentY, scale);
        currentY += h + 28;
      } else if (key === 'rows') {
        const h = renderStandings(ctx, rawRows, currentY, scale, maxRows, accent);
        currentY += h + 28;
      } else if (key === 'matches') {
        const h = renderMatches(ctx, rawMatches, currentY, scale, maxMatches, accent);
        currentY += h + 28;
      }
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create canvas blob'));
    }, 'image/png');
  });
}
