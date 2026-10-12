/**
 * woodTheme.js – Visual theme & procedural drawing utilities for Long Shot.
 *
 * Grounded in a Lagos compound-wall setting:
 * - Palette: Iroko, Mahogany, Pine, Danfo Yellow, Concrete grey, Warm Dusk.
 * - Procedural textures for concrete compound wall, wooden ledges/signs,
 *   subtle street silhouettes, utility poles, hanging bulbs, and distant danfo.
 */

export const THEME = {
  // Woods
  iroko:       '#4e2e18',
  irokoDark:   '#382010',
  mahogany:    '#321610',
  mahoganyDark:'#220d09',
  pine:        '#b89758',
  pineLight:   '#d4b276',

  // Lagos Street & Atmosphere
  danfoYellow: '#f7b500',
  danfoStripe: '#111111',
  duskSkyTop:  '#1d1430',
  duskSkyMid:  '#3d1e3d',
  duskSkyLow:  '#78373b',
  duskHorizon: '#b85a3c',
  warmGlow:    '#ffbe53',

  // Compound Wall (Painted weathered concrete)
  wallBase:    '#8a8277',
  wallLight:   '#9e968a',
  wallDark:    '#686056',
  wallStain:   'rgba(50, 42, 35, 0.18)',
  mortarLine:  'rgba(40, 35, 30, 0.28)',

  // Green glass bottles
  bottleGlass: '#2e7d32',
  bottleGlassDark: '#1b5e20',
  bottleHighlight: 'rgba(255, 255, 255, 0.35)',
  bottleCap:   '#d4af37',

  // UI accents
  uiText:      '#ffffff',
  uiTextMuted: '#e0d6c8',
  accentGold:  '#f5b800',
  accentRed:   '#e53935',

  // Fonts
  fontDisplay: '"Danfo", "Impact", "Arial Black", sans-serif',
  fontBody:    '"Zilla Slab", "Georgia", serif',
  fontUI:      '"Segoe UI", -apple-system, sans-serif',
};

/**
 * Procedurally draws the Lagos compound environment:
 * Dusk sky, distant roof silhouettes, utility pole, compound wall with ledges.
 */
export function drawLagosEnvironment(ctx, cw, ch, ppu, offX, offY, time = 0) {
  // ── 1. Warm late-afternoon / dusk sky gradient ──
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ch * 0.45);
  skyGrad.addColorStop(0.0, THEME.duskSkyTop);
  skyGrad.addColorStop(0.4, THEME.duskSkyMid);
  skyGrad.addColorStop(0.75, THEME.duskSkyLow);
  skyGrad.addColorStop(1.0, THEME.duskHorizon);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, cw, ch * 0.45);

  // Distant warm sunset haze near wall top
  const hazeGrad = ctx.createRadialGradient(cw * 0.5, ch * 0.35, 10, cw * 0.5, ch * 0.35, cw * 0.6);
  hazeGrad.addColorStop(0, 'rgba(255, 180, 80, 0.25)');
  hazeGrad.addColorStop(1, 'rgba(255, 180, 80, 0)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, 0, cw, ch * 0.45);

  // ── 2. Distant Lagos street skyline silhouettes (rooftops, water tanks, trees) ──
  ctx.save();
  ctx.fillStyle = 'rgba(25, 16, 32, 0.85)';
  ctx.beginPath();
  const skyY = ch * 0.28;
  ctx.moveTo(0, skyY);
  // Jagged rooftops & water tank silhouettes
  ctx.lineTo(cw * 0.08, skyY - ch * 0.02);
  ctx.lineTo(cw * 0.16, skyY - ch * 0.015);
  // Water tank on roof
  ctx.rect(cw * 0.18, skyY - ch * 0.045, cw * 0.05, ch * 0.045);
  ctx.moveTo(cw * 0.24, skyY);
  ctx.lineTo(cw * 0.32, skyY - ch * 0.01);
  ctx.lineTo(cw * 0.42, skyY - ch * 0.035);
  ctx.lineTo(cw * 0.48, skyY - ch * 0.015);
  // Distant palm/tree fronds
  ctx.lineTo(cw * 0.55, skyY - ch * 0.04);
  ctx.lineTo(cw * 0.62, skyY - ch * 0.01);
  ctx.lineTo(cw * 0.72, skyY - ch * 0.028);
  ctx.lineTo(cw * 0.80, skyY - ch * 0.018);
  ctx.lineTo(cw * 0.88, skyY - ch * 0.04);
  ctx.lineTo(cw, skyY - ch * 0.02);
  ctx.lineTo(cw, skyY + ch * 0.08);
  ctx.lineTo(0, skyY + ch * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── 3. Subtle passing Danfo in the distance (low cost, periodic) ──
  // Cycles every 24 seconds across the horizon gap behind the wall top
  const danfoCycle = (time * 0.04) % 1.4 - 0.2; // -0.2 to 1.2
  if (danfoCycle >= -0.15 && danfoCycle <= 1.15) {
    const danfoX = cw * danfoCycle;
    const danfoY = ch * 0.265;
    const danfoW = cw * 0.14;
    const danfoH = ch * 0.022;

    ctx.save();
    // Yellow body
    ctx.fillStyle = THEME.danfoYellow;
    ctx.fillRect(danfoX, danfoY, danfoW, danfoH);
    // Two black horizontal stripes (iconic Lagos danfo)
    ctx.fillStyle = THEME.danfoStripe;
    ctx.fillRect(danfoX, danfoY + danfoH * 0.38, danfoW, danfoH * 0.14);
    ctx.fillRect(danfoX, danfoY + danfoH * 0.62, danfoW, danfoH * 0.14);
    // Windows
    ctx.fillStyle = 'rgba(25, 20, 30, 0.75)';
    ctx.fillRect(danfoX + danfoW * 0.1, danfoY + danfoH * 0.08, danfoW * 0.2, danfoH * 0.25);
    ctx.fillRect(danfoX + danfoW * 0.36, danfoY + danfoH * 0.08, danfoW * 0.25, danfoH * 0.25);
    ctx.fillRect(danfoX + danfoW * 0.67, danfoY + danfoH * 0.08, danfoW * 0.25, danfoH * 0.25);
    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(danfoX + danfoW * 0.15, danfoY + danfoH * 0.88, danfoW * 0.18, danfoH * 0.25);
    ctx.fillRect(danfoX + danfoW * 0.68, danfoY + danfoH * 0.88, danfoW * 0.18, danfoH * 0.25);
    ctx.restore();
  }

  // ── 4. Utility pole & hanging bulb ──
  ctx.save();
  const poleX = cw * 0.12;
  const poleTopY = ch * 0.12;
  const wallTopY = ch * 0.285;

  // Wooden utility pole
  ctx.strokeStyle = THEME.mahoganyDark;
  ctx.lineWidth = Math.max(3, cw * 0.015);
  ctx.beginPath();
  ctx.moveTo(poleX, wallTopY + ch * 0.1);
  ctx.lineTo(poleX, poleTopY);
  ctx.stroke();

  // Crossarm
  ctx.lineWidth = Math.max(2, cw * 0.009);
  ctx.beginPath();
  ctx.moveTo(poleX - cw * 0.04, poleTopY + ch * 0.02);
  ctx.lineTo(poleX + cw * 0.04, poleTopY + ch * 0.02);
  ctx.stroke();

  // Power lines swooping across sky
  ctx.strokeStyle = 'rgba(20, 15, 25, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, poleTopY + ch * 0.01);
  ctx.quadraticCurveTo(poleX * 0.5, poleTopY + ch * 0.04, poleX - cw * 0.035, poleTopY + ch * 0.02);
  ctx.moveTo(poleX + cw * 0.035, poleTopY + ch * 0.02);
  ctx.quadraticCurveTo(cw * 0.55, poleTopY + ch * 0.06, cw, poleTopY + ch * 0.03);
  ctx.stroke();

  // Hanging warm street bulb on a cord
  const bulbX = poleX + cw * 0.035;
  const bulbY = poleTopY + ch * 0.07;
  ctx.strokeStyle = 'rgba(30, 20, 20, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(poleX, poleTopY + ch * 0.02);
  ctx.lineTo(bulbX, bulbY);
  ctx.stroke();

  // Warm bulb glow
  const bulbGlow = ctx.createRadialGradient(bulbX, bulbY, 2, bulbX, bulbY, cw * 0.15);
  bulbGlow.addColorStop(0, 'rgba(255, 220, 120, 0.8)');
  bulbGlow.addColorStop(0.3, 'rgba(255, 180, 50, 0.3)');
  bulbGlow.addColorStop(1, 'rgba(255, 150, 30, 0)');
  ctx.fillStyle = bulbGlow;
  ctx.beginPath();
  ctx.arc(bulbX, bulbY, cw * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Glass bulb center
  ctx.fillStyle = '#fff9d6';
  ctx.beginPath();
  ctx.arc(bulbX, bulbY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 5. The Compound Wall (Hero visual element) ──
  // Starts at wallTopY (~28.5% height) down to ground (~94%)
  const wallH = ch - wallTopY;
  const wallGrad = ctx.createLinearGradient(0, wallTopY, 0, ch);
  wallGrad.addColorStop(0.0, THEME.wallLight);
  wallGrad.addColorStop(0.25, THEME.wallBase);
  wallGrad.addColorStop(0.7, '#746c60');
  wallGrad.addColorStop(1.0, THEME.wallDark);
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, wallTopY, cw, wallH);

  // Concrete wall coping / top ledge cap
  ctx.fillStyle = '#b0a89c';
  ctx.fillRect(0, wallTopY - ch * 0.012, cw, ch * 0.015);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, wallTopY + ch * 0.003, cw, ch * 0.006); // cast shadow under cap

  // Concrete block mortar lines (procedural brick pattern)
  ctx.save();
  ctx.strokeStyle = THEME.mortarLine;
  ctx.lineWidth = 1.2;
  const blockH = ch * 0.055;
  const blockW = cw * 0.24;
  let row = 0;
  for (let y = wallTopY + ch * 0.01; y < ch * 0.94; y += blockH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cw, y);
    ctx.stroke();

    const rowOffset = (row % 2) * (blockW * 0.5);
    for (let x = -rowOffset; x < cw; x += blockW) {
      if (x > 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.min(y + blockH, ch * 0.94));
        ctx.stroke();
      }
    }
    row++;
  }

  // Weathering, paint stains, algae patches (procedural grounded realism)
  ctx.fillStyle = THEME.wallStain;
  // Left stain drip
  ctx.fillRect(cw * 0.15, wallTopY + ch * 0.02, cw * 0.08, ch * 0.35);
  // Center water stain
  ctx.fillRect(cw * 0.52, wallTopY + ch * 0.05, cw * 0.14, ch * 0.45);
  // Right side discoloration
  ctx.fillRect(cw * 0.78, wallTopY + ch * 0.08, cw * 0.09, ch * 0.3);

  // Subtle hand-painted chalk / graffiti sign on wall: "NO PARKING / LONG SHOT"
  ctx.fillStyle = 'rgba(240, 230, 210, 0.18)';
  ctx.font = `bold ${Math.round(cw * 0.04)}px ${THEME.fontDisplay}`;
  ctx.textAlign = 'center';
  ctx.fillText('NO PARKING · OKADA ₦500', cw * 0.5, wallTopY + ch * 0.12);

  ctx.restore();

  // ── 6. Sandy compound ground strip with warm dust ──
  const groundY = ch * 0.93;
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, ch);
  groundGrad.addColorStop(0, '#533c2a');
  groundGrad.addColorStop(1, '#2c1e14');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, cw, ch - groundY);

  // Ground pebbles / dust texture
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, groundY, cw, 2);
}

/**
 * Draws a sturdy wooden shelf / concrete wall ledge for each tier.
 */
export function drawWallLedge(ctx, x, y, width, height, tierScale) {
  // Cast shadow onto the compound wall below the ledge
  ctx.fillStyle = 'rgba(20, 15, 10, 0.45)';
  ctx.fillRect(x - width * 0.02, y + height, width * 1.04, height * 1.8);

  // Wooden plank / concrete block body
  const ledgeGrad = ctx.createLinearGradient(0, y, 0, y + height);
  ledgeGrad.addColorStop(0, THEME.pineLight);
  ledgeGrad.addColorStop(0.3, THEME.iroko);
  ledgeGrad.addColorStop(1, THEME.mahoganyDark);
  ctx.fillStyle = ledgeGrad;
  ctx.fillRect(x, y, width, height);

  // Top highlight edge
  ctx.fillStyle = 'rgba(255, 235, 180, 0.4)';
  ctx.fillRect(x, y, width, Math.max(1, height * 0.2));

  // Wood grain lines
  ctx.strokeStyle = THEME.mahogany;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.1, y + height * 0.5);
  ctx.lineTo(x + width * 0.85, y + height * 0.55);
  ctx.stroke();

  // Nail heads on wooden shelf
  if (tierScale > 0.5) {
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x + width * 0.08, y + height * 0.5, 1.2, 0, Math.PI * 2);
    ctx.arc(x + width * 0.92, y + height * 0.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draws an authentic glass bottle (green malt/beer bottle with neck, cap, glass shine).
 */
export function drawLagosBottle(ctx, bx, by, bw, bh, tier, timeLeftFrac = 1.0) {
  const sc = tier.scale;

  // Bottle shadow on the shelf
  ctx.fillStyle = 'rgba(10, 8, 5, 0.4)';
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by + bh + 1, bw * 0.55, bw * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main bottle body gradient (rich green glass)
  const bodyY = by + bh * 0.32;
  const bodyH = bh * 0.68;
  const glassGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  glassGrad.addColorStop(0.0, THEME.bottleGlassDark);
  glassGrad.addColorStop(0.25, THEME.bottleGlass);
  glassGrad.addColorStop(0.65, '#388e3c');
  glassGrad.addColorStop(0.95, THEME.bottleGlassDark);

  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  // Rounded lower base
  ctx.roundRect(bx, bodyY, bw, bodyH, [bw * 0.1, bw * 0.1, bw * 0.2, bw * 0.2]);
  ctx.fill();

  // Shoulder and tapered neck
  const neckW = bw * 0.36;
  const neckX = bx + (bw - neckW) / 2;
  const neckY = by + bh * 0.08;
  const neckH = bh * 0.26;

  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.1, bodyY);
  ctx.quadraticCurveTo(neckX, bodyY, neckX, neckY + neckH * 0.4);
  ctx.lineTo(neckX, neckY);
  ctx.lineTo(neckX + neckW, neckY);
  ctx.lineTo(neckX + neckW, neckY + neckH * 0.4);
  ctx.quadraticCurveTo(neckX + neckW, bodyY, bx + bw * 0.9, bodyY);
  ctx.closePath();
  ctx.fill();

  // Golden bottle crown cap
  ctx.fillStyle = THEME.bottleCap;
  ctx.fillRect(neckX - bw * 0.04, by, neckW + bw * 0.08, bh * 0.08);
  ctx.fillStyle = '#fff4a3';
  ctx.fillRect(neckX, by, neckW, bh * 0.03);

  // Paper label on bottle belly
  const labelH = bodyH * 0.42;
  const labelY = bodyY + bodyH * 0.26;
  ctx.fillStyle = '#f5ede0';
  ctx.fillRect(bx + bw * 0.08, labelY, bw * 0.84, labelH);
  // Red/Gold star or brand stripe on label
  ctx.fillStyle = THEME.danfoYellow;
  ctx.fillRect(bx + bw * 0.08, labelY + labelH * 0.35, bw * 0.84, labelH * 0.3);
  ctx.fillStyle = THEME.accentRed;
  ctx.fillRect(bx + bw * 0.35, labelY + labelH * 0.38, bw * 0.3, labelH * 0.24);

  // Vertical glass reflection / gloss highlight
  ctx.fillStyle = THEME.bottleHighlight;
  ctx.fillRect(bx + bw * 0.16, bodyY + bodyH * 0.05, bw * 0.14, bodyH * 0.88);
  ctx.fillRect(neckX + neckW * 0.16, neckY, neckW * 0.2, neckH);

  // Expiring timer halo / pulse when timeLeft is low (< 1.5s)
  if (timeLeftFrac < 0.4) {
    ctx.strokeStyle = `rgba(255, 87, 34, ${0.4 + 0.4 * Math.sin(Date.now() * 0.015)})`;
    ctx.lineWidth = Math.max(1, 2 * sc);
    ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
  }

  // Tier Distance Badge (L1 to L5)
  if (sc >= 0.4) {
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.max(9, Math.round(bw * 0.55))}px ${THEME.fontDisplay}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${tier.points}`, bx + bw / 2, labelY + labelH * 0.65);
  }
}

/**
 * Draws a wooden signboard button with bevel and wood grain.
 */
export function drawWoodButton(ctx, x, y, w, h, text, isPrimary = false, icon = '') {
  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 3, w, h, h * 0.22);
  ctx.fill();

  // Wood gradient
  const bgGrad = ctx.createLinearGradient(0, y, 0, y + h);
  if (isPrimary) {
    bgGrad.addColorStop(0, '#f9c833');
    bgGrad.addColorStop(0.5, THEME.danfoYellow);
    bgGrad.addColorStop(1, '#d99700');
  } else {
    bgGrad.addColorStop(0, THEME.pine);
    bgGrad.addColorStop(0.5, THEME.iroko);
    bgGrad.addColorStop(1, THEME.mahoganyDark);
  }
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h * 0.22);
  ctx.fill();

  // Bevel border
  ctx.strokeStyle = isPrimary ? '#ffe885' : THEME.pineLight;
  ctx.lineWidth = Math.max(1.5, h * 0.04);
  ctx.stroke();

  // Inner subtle border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, h * 0.18);
  ctx.stroke();

  // Text label
  ctx.fillStyle = isPrimary ? '#1b120c' : '#fff9ed';
  ctx.font = `bold ${Math.round(h * 0.42)}px ${THEME.fontDisplay}`;
  ctx.textAlign = 'center';
  const label = icon ? `${icon}  ${text}` : text;
  ctx.fillText(label, x + w / 2, y + h * 0.64);
}
