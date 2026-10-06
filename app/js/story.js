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

// Extract up to 2 uppercase initials from a name
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Asynchronously load remote image with CORS support
function loadRemoteImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Draw circular avatar with image or initial fallback, surrounded by a colored medal ring
function drawAvatar(ctx, cx, cy, radius, img, fallbackText, borderColor) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();

  if (img) {
    ctx.save();
    ctx.clip();
    const size = radius * 2;
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    const s = Math.max(size / sw, size / sh);
    const dw = sw * s;
    const dh = sh * s;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = '#2A1B3D';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `600 ${Math.round(radius * 0.75)}px "DM Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackText, cx, cy);
  }

  // Medal border ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(3, Math.round(radius * 0.1));
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  ctx.restore();
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
 * Load HTMLImageElement from a local file object (supports JPG/PNG, rejects HEIC)
 */
async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Could not read this photo — try a JPG or PNG'));
      return;
    }
    // HEIC is tried too: Safari can decode it, other browsers fail in onerror
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
 * Render story image (1080x1920 PNG Blob)
 */
async function renderStory(opts = {}) {
  // Preload custom fonts
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
  const sectionsOrder = opts.sections || ['podium', 'rows', 'matches'];

  // Background
  if (opts.photo) {
    coverDraw(ctx, opts.photo, 1080, 1920);
    const darkGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    darkGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    darkGrad.addColorStop(0.24, 'rgba(0, 0, 0, 0.45)');
    darkGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.76)');
    darkGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
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

  // Preload podium remote avatars
  const rawPodium = Array.isArray(opts.podium) ? opts.podium.slice(0, 3) : [];
  const podiumAvatars = await Promise.all(rawPodium.map((p) => loadRemoteImage(p.photoUrl)));

  // IG safe zones: top safe zone 220px, bottom safe zone 200px
  const startContentY = 380;
  const endContentY = 1710;
  const totalAvailableH = endContentY - startContentY;

  // Header drawing (starts at y=236, safely below 220px)
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '86px "Bebas Neue", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(fitText(ctx, title, 952), 64, 236);

  if (subtitle) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.font = '500 28px "DM Sans", sans-serif';
    ctx.fillText(fitText(ctx, subtitle, 952), 64, 326);
  }
  ctx.restore();

  // Footer (sits at y ≈ 1840 small and muted)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '500 24px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(footerText, 540, 1840);

  // Active section data
  const hasPodium = sectionsOrder.includes('podium') && rawPodium.length > 0;
  const rawRows = Array.isArray(opts.rows) ? opts.rows : [];
  const hasRows = sectionsOrder.includes('rows') && rawRows.length > 0;
  const rawMatches = Array.isArray(opts.matches) ? opts.matches : [];
  const hasMatches = sectionsOrder.includes('matches') && rawMatches.length > 0;

  const activeSectionKeys = sectionsOrder.filter((key) => {
    if (key === 'podium') return hasPodium;
    if (key === 'rows') return hasRows;
    if (key === 'matches') return hasMatches;
    return false;
  });

  // Calculate layout heights and auto-fit
  const minFont = 26;
  const baseFont = 32;
  const minScale = minFont / baseFont; // ~0.8125

  let maxRows = Math.min(10, rawRows.length);
  if (rawRows.length > 10) maxRows = 9; // Reserve 1 slot for "+N more"

  let maxMatches = Math.min(12, rawMatches.length);
  if (rawMatches.length > 12) maxMatches = 11; // Reserve 1 slot for "+N more matches"

  const sectionGapsTotal = Math.max(0, activeSectionKeys.length - 1) * 28;
  const netHeightBudget = totalAvailableH - sectionGapsTotal;

  function measureRequiredHeight(s, rCount, mCount) {
    let h = 0;
    for (const key of activeSectionKeys) {
      if (key === 'podium') {
        h += Math.round(330 * s);
      } else if (key === 'rows') {
        const slots = rawRows.length <= rCount ? rawRows.length : rCount + 1;
        h += Math.round(36 * s) + slots * Math.round(52 * s);
      } else if (key === 'matches') {
        const slots = rawMatches.length <= mCount ? rawMatches.length : mCount + 1;
        h += Math.round(36 * s) + slots * Math.round(48 * s);
      }
    }
    return h;
  }

  // Adjust items if content still overflows at min scale
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

  // Find optimal scale between minScale and 1.0
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

  // Render sections in requested order
  for (const key of activeSectionKeys) {
    if (key === 'podium') {
      const podH = Math.round(330 * scale);
      const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
      const slotConfigs = [
        { rankIndex: 0, x: 540, radius: Math.round(88 * scale), dy: 0, rankNum: '1' },
        { rankIndex: 1, x: 235, radius: Math.round(70 * scale), dy: Math.round(40 * scale), rankNum: '2' },
        { rankIndex: 2, x: 845, radius: Math.round(70 * scale), dy: Math.round(56 * scale), rankNum: '3' },
      ];

      for (let i = 0; i < rawPodium.length; i++) {
        const cfg = slotConfigs[i];
        const item = rawPodium[cfg.rankIndex];
        if (!item) continue;
        const color = medalColors[cfg.rankIndex];
        const avatarY = currentY + cfg.radius + cfg.dy;

        drawAvatar(ctx, cfg.x, avatarY, cfg.radius, podiumAvatars[cfg.rankIndex], getInitials(item.name), color);

        // Small rank badge on avatar bottom
        const badgeR = Math.round(20 * scale);
        ctx.beginPath();
        ctx.arc(cfg.x, avatarY + cfg.radius - 2, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = '#0F031D';
        ctx.font = `700 ${Math.round(28 * scale)}px "Bebas Neue", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.rankNum, cfg.x, avatarY + cfg.radius - 2);

        // Player name
        const nameY = avatarY + cfg.radius + Math.round(48 * scale);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 ${Math.round(34 * scale)}px "DM Sans", sans-serif`;
        ctx.fillText(fitText(ctx, item.name, 280), cfg.x, nameY);

        // Player value (e.g. 42 pts)
        const valY = nameY + Math.round(40 * scale);
        ctx.fillStyle = color;
        ctx.font = `${Math.round(40 * scale)}px "Bebas Neue", sans-serif`;
        ctx.fillText(item.value, cfg.x, valY);


      }

      currentY += podH + 28;
    } else if (key === 'rows') {
      const headerH = Math.round(36 * scale);
      ctx.fillStyle = accent;
      ctx.font = `${Math.round(26 * scale)}px "Bebas Neue", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('STANDINGS', 64, currentY + headerH / 2);

      const titleW = ctx.measureText('STANDINGS').width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(64 + titleW + 16, currentY + headerH / 2);
      ctx.lineTo(1016, currentY + headerH / 2);
      ctx.stroke();

      currentY += headerH;

      const slotH = Math.round(52 * scale);
      const rowItemH = slotH - Math.round(6 * scale);
      const displayedCount = Math.min(maxRows, rawRows.length);
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

        // Rank indicator
        const rankColor = row.rank === 1 ? '#FFD700' : row.rank === 2 ? '#C0C0C0' : row.rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.7)';
        ctx.fillStyle = rankColor;
        ctx.font = `${Math.round(28 * scale)}px "Bebas Neue", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(row.rank), 98, rowY + rowItemH / 2);

        // Value on right
        ctx.fillStyle = accent;
        ctx.font = `${Math.round(30 * scale)}px "Bebas Neue", sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(row.value, 996, rowY + rowItemH / 2);
        const valWidth = ctx.measureText(row.value).width;

        // Player name and optional subtext
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
      currentY += totalSlots * slotH + 28;
    } else if (key === 'matches') {
      const headerH = Math.round(36 * scale);
      ctx.fillStyle = accent;
      ctx.font = `${Math.round(26 * scale)}px "Bebas Neue", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('MATCH RESULTS', 64, currentY + headerH / 2);

      const titleW = ctx.measureText('MATCH RESULTS').width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(64 + titleW + 16, currentY + headerH / 2);
      ctx.lineTo(1016, currentY + headerH / 2);
      ctx.stroke();

      currentY += headerH;

      const slotH = Math.round(48 * scale);
      const matchItemH = slotH - Math.round(6 * scale);
      const displayedCount = Math.min(maxMatches, rawMatches.length);
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

        const aWon = m.sa !== null && m.sb !== null && m.sa > m.sb;
        const bWon = m.sa !== null && m.sb !== null && m.sb > m.sa;

        // Round label (if provided)
        let labelOffset = 0;
        if (m.label) {
          labelOffset = Math.round(130 * scale);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.font = `500 ${Math.round(18 * scale)}px "DM Sans", sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(fitText(ctx, m.label, labelOffset - 12), 82, matchY + matchItemH / 2);
        }

        // Center score capsule
        const pillW = Math.round(86 * scale);
        const pillH = Math.round(30 * scale);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        roundRect(ctx, 540 - pillW / 2, matchY + (matchItemH - pillH) / 2, pillW, pillH, 6);
        ctx.fill();

        const scoreText = `${m.sa !== null ? m.sa : '-'} : ${m.sb !== null ? m.sb : '-'}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${Math.round(25 * scale)}px "Bebas Neue", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(scoreText, 540, matchY + matchItemH / 2);

        // Player A (right-aligned towards center)
        const leftBoundary = 64 + (labelOffset > 0 ? labelOffset + 16 : 20);
        const rightBoundaryA = 540 - pillW / 2 - Math.round(14 * scale);
        const maxWA = Math.max(60, rightBoundaryA - leftBoundary);

        ctx.textAlign = 'right';
        ctx.fillStyle = aWon ? accent : bWon ? 'rgba(255, 255, 255, 0.45)' : '#FFFFFF';
        ctx.font = `${aWon ? '700' : '500'} ${Math.round(24 * scale)}px "DM Sans", sans-serif`;
        ctx.fillText(fitText(ctx, m.a, maxWA), rightBoundaryA, matchY + matchItemH / 2);

        // Player B (left-aligned towards right margin)
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
      currentY += totalSlots * slotH + 28;
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create canvas blob'));
    }, 'image/png');
  });
}
