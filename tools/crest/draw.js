/* Clan Crest Creator — drawing.
   Builds the crest as an SVG picture from the current choices. This is the old
   tool's drawing code (clan-crest-creator/app.js, draw() to renderBanner(),
   and the shield and sigil shapes), carried across line for line so every
   crest looks exactly as it did. Only three things changed:
   - The picture's hidden part names start "tsi-crest-svg-" (they were
     "shadow", "tex" and so on), so nothing else on the page, including the
     Crest's own controls, can clash with them (KNOWN_ISSUES CRS-01).
   - The motto is set in the suite's Cinzel font (Harry's answer K4). For the
     downloaded PNG the font file is packed inside the picture, because a
     picture can't use the page's fonts; so the preview and the PNG match.
   - It returns the picture as text instead of putting it on the page.
   Plain functions with no screen code, so tests can check them. */
(function () {
  "use strict";

  const TSI = window.TSI = window.TSI || {};
  const crest = TSI.crest = TSI.crest || {};

  const MOTTO_FONT = "Cinzel";
  const PALETTES = () => window.TSI_DATA.crest.palettes;

  // ---------- Shapes, by id (names and order are in data/crest-data.js) ----------
  const SHIELDS = [
    { id:"heater",  path: shieldPathHeater },
    { id:"round",   path: shieldPathRound },
    { id:"kite",    path: shieldPathKite },
    { id:"spanish", path: shieldPathSpanish },
    { id:"gothic",  path: shieldPathGothic },
    { id:"badge",   path: shieldPathOval },
  ];

  const SIGILS = [
    { id:"sword", draw: sigilSword },
    { id:"twinSwords", draw: sigilTwinSwords },
    { id:"crown", draw: sigilCrown },
    { id:"tree", draw: sigilTree },
    { id:"wave", draw: sigilWave },
    { id:"mountain", draw: sigilMountain },
    { id:"moon", draw: sigilMoon },
    { id:"sun", draw: sigilSun },
    { id:"eye", draw: sigilEye },
    { id:"anchor", draw: sigilAnchor },
    { id:"book", draw: sigilBook },
    { id:"rune", draw: sigilRuneKnot },
    { id:"stag", draw: sigilStagSimple },
    { id:"flame", draw: sigilFlame },
    { id:"shield", draw: sigilMiniShield },
    { id:"compass", draw: sigilCompass },
  ];

  /* For the downloaded PNG: the motto font packed into the picture. Only added
     when a motto is shown, so crests without one stay small. */
  function fontFace(banner, options){
    if(!banner || !options.fontDataUrl) return "";
    return `<style>@font-face{font-family:"${MOTTO_FONT}";src:url(${options.fontDataUrl}) format("truetype");font-weight:400 900;font-style:normal;}</style>`;
  }

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // ---------- SVG render ----------
  function draw(state, options){
    options = options || {};
    const palette = PALETTES().find(p => p.id === state.palette) || PALETTES()[0];
    const shield = SHIELDS.find(s => s.id === state.shieldShape) || SHIELDS[0];

    const W = 1024, H = 1024;
    const shieldD = shield.path(180, 110, 664, 790);

    const borderW = state.borderWidth;
    const clipId = "tsi-crest-svg-clip";
    const texId = "tsi-crest-svg-texture";
    const gradId = "tsi-crest-svg-gloss";

    const bg = renderPattern(state.patternType, palette, shieldD);
    const texture = renderTexture(state.texture, texId);
    const border = renderBorder(state.borderStyle, palette, shieldD, borderW);
    const gloss = `
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(255,255,255,0.30)"/>
        <stop offset="0.35" stop-color="rgba(255,255,255,0.06)"/>
        <stop offset="1" stop-color="rgba(0,0,0,0.25)"/>
      </linearGradient>
    `;

    const sigil = renderSigil(state, palette);
    const banner = renderBanner(state, palette);

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${options.size || "100%"}" height="${options.size || "100%"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Clan crest">
  <defs>${fontFace(banner, options)}
    <clipPath id="${clipId}">
      <path d="${shieldD}"></path>
    </clipPath>
    ${bg.defs || ""}
    ${texture.defs || ""}
    ${gloss}
    <filter id="tsi-crest-svg-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="22" stdDeviation="20" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>

  <!-- Crest group only: transparent outside -->
  <g filter="url(#tsi-crest-svg-shadow)">
    <!-- Shield base -->
    <path d="${shieldD}" fill="${palette.c}"></path>

    <!-- Pattern clipped inside shield -->
    <g clip-path="url(#${clipId})">
      ${bg.body || ""}
      ${texture.body || ""}
      <!-- subtle vignette -->
      <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(0,0,0,0.10)"></rect>
      <path d="${shieldD}" fill="url(#${gradId})" opacity="0.55"></path>
    </g>

    ${border}

    <!-- Sigil -->
    ${sigil}

    <!-- Banner -->
    ${banner}
  </g>
</svg>`;

    return svg;
  }

  // ---------- Patterns ----------
  function renderPattern(patternId, palette, shieldD){
    const defs = [];
    let body = "";

    // Helper rects clipped to shield
    const full = `<rect x="0" y="0" width="1024" height="1024" fill="${palette.a}"></rect>`;
    const halfTop = `<rect x="0" y="0" width="1024" height="512" fill="${palette.a}"></rect><rect x="0" y="512" width="1024" height="512" fill="${palette.b}"></rect>`;
    const halfLeft = `<rect x="0" y="0" width="512" height="1024" fill="${palette.a}"></rect><rect x="512" y="0" width="512" height="1024" fill="${palette.b}"></rect>`;

    switch(patternId){
      case "solid":
        body = `<rect x="0" y="0" width="1024" height="1024" fill="${palette.a}"></rect>`;
        break;
      case "perFess":
        body = halfTop;
        break;
      case "perPale":
        body = halfLeft;
        break;
      case "perBend":
        body = `
          <polygon points="0,0 1024,0 0,1024" fill="${palette.a}"></polygon>
          <polygon points="1024,0 1024,1024 0,1024" fill="${palette.b}"></polygon>
        `;
        break;
      case "quarterly":
        body = `
          <rect x="0" y="0" width="512" height="512" fill="${palette.a}"></rect>
          <rect x="512" y="0" width="512" height="512" fill="${palette.b}"></rect>
          <rect x="0" y="512" width="512" height="512" fill="${palette.b}"></rect>
          <rect x="512" y="512" width="512" height="512" fill="${palette.a}"></rect>
        `;
        break;
      case "chevron":
        body = `
          ${full}
          <polygon points="140,620 512,320 884,620 884,760 512,460 140,760" fill="${palette.b}" opacity="0.95"></polygon>
        `;
        break;
      case "stripes": {
        const stripe = `
          <pattern id="tsi-crest-svg-stripes" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <rect width="80" height="80" fill="${palette.a}"/>
            <rect x="0" y="0" width="38" height="80" fill="${palette.b}" opacity="0.95"/>
          </pattern>`;
        defs.push(stripe);
        body = `<rect x="0" y="0" width="1024" height="1024" fill="url(#tsi-crest-svg-stripes)"></rect>`;
        break;
      }
      case "cross":
        body = `
          ${full}
          <rect x="440" y="0" width="144" height="1024" fill="${palette.b}" opacity="0.96"></rect>
          <rect x="0" y="440" width="1024" height="144" fill="${palette.b}" opacity="0.96"></rect>
        `;
        break;
      default:
        body = full;
    }

    return { defs: defs.join("\n"), body };
  }

  // ---------- Textures ----------
  function renderTexture(textureId, texId){
    if(textureId === "none") return { defs:"", body:"" };

    const defs = [];
    let body = "";

    if(textureId === "grain"){
      defs.push(`
        <filter id="${texId}">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            0 0 0 .22 0" />
        </filter>
      `);
      body = `<rect x="0" y="0" width="1024" height="1024" filter="url(#${texId})" opacity="0.55"></rect>`;
    }

    if(textureId === "speckle"){
      defs.push(`
        <filter id="${texId}">
          <feTurbulence type="turbulence" baseFrequency="0.75" numOctaves="3" seed="8" />
          <feColorMatrix type="matrix" values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            0 0 0 .18 0" />
        </filter>
      `);
      body = `<rect x="0" y="0" width="1024" height="1024" filter="url(#${texId})" opacity="0.55"></rect>`;
    }

    if(textureId === "etch"){
      defs.push(`
        <filter id="${texId}">
          <feTurbulence type="fractalNoise" baseFrequency="0.18" numOctaves="4" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="10" />
        </filter>
      `);
      body = `<rect x="0" y="0" width="1024" height="1024" filter="url(#${texId})" opacity="0.25"></rect>`;
    }

    return { defs: defs.join("\n"), body };
  }

  // ---------- Borders ----------
  function renderBorder(borderId, palette, shieldD, w){
    const stroke = palette.b;
    const stroke2 = "rgba(0,0,0,0.35)";
    const inner = w * 0.55;

    if(borderId === "plain"){
      return `<path d="${shieldD}" fill="none" stroke="${stroke}" stroke-width="${w}" />`;
    }

    if(borderId === "double"){
      return `
        <path d="${shieldD}" fill="none" stroke="${stroke}" stroke-width="${w}" />
        <path d="${shieldD}" fill="none" stroke="${stroke2}" stroke-width="${inner}" opacity="0.7"/>
      `;
    }

    if(borderId === "notched"){
      // Fake notches by dashed stroke
      return `
        <path d="${shieldD}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="10 16"/>
        <path d="${shieldD}" fill="none" stroke="${stroke2}" stroke-width="${inner}" opacity="0.55"/>
      `;
    }

    if(borderId === "rope"){
      return `
        <path d="${shieldD}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="3 9"/>
        <path d="${shieldD}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="${inner}" opacity="0.65"/>
      `;
    }

    if(borderId === "beaded"){
      return `
        <path d="${shieldD}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="1 18"/>
        <path d="${shieldD}" fill="none" stroke="${stroke2}" stroke-width="${inner}" opacity="0.55"/>
      `;
    }

    return `<path d="${shieldD}" fill="none" stroke="${stroke}" stroke-width="${w}" />`;
  }

  // ---------- Sigil ----------
  function renderSigil(st, palette){
    const sig = SIGILS.find(s => s.id === st.sigilType) || SIGILS[0];
    const size = st.sigilScale;

    const cx = 512, cy = 520;
    const fillA = palette.b;
    const fillB = palette.a;
    const stroke = "rgba(0,0,0,0.55)";
    const outline = "rgba(255,255,255,0.18)";

    const mode = st.sigilFillMode;

    const parts = sig.draw({ cx, cy, size, palette });

    if(mode === "solid"){
      return `
        <g>
          <g fill="${fillA}" stroke="${stroke}" stroke-width="6" stroke-linejoin="round">
            ${parts.solid || parts.base || ""}
          </g>
        </g>
      `;
    }

    if(mode === "outline"){
      return `
        <g>
          <g fill="none" stroke="${fillA}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
            ${parts.outline || parts.base || ""}
          </g>
          <g fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
            ${parts.outline || parts.base || ""}
          </g>
        </g>
      `;
    }

    // twoTone
    return `
      <g>
        <g fill="${fillA}" stroke="${stroke}" stroke-width="6" stroke-linejoin="round">
          ${parts.solid || parts.base || ""}
        </g>
        <g fill="${fillB}" opacity="0.70" stroke="rgba(0,0,0,0.35)" stroke-width="3" stroke-linejoin="round">
          ${parts.accent || ""}
        </g>
      </g>
    `;
  }

  // ---------- Banner ----------
  function renderBanner(st, palette){
    const style = st.bannerStyle;
    const text = (st.bannerText || "").trim();
    if(style === "none" || !text) return "";

    const fill = "rgba(10,8,8,0.65)";
    const stroke = palette.b;

    const x = 280, y = 820, w = 464, h = 120;
    const safe = escapeHtml(text.toUpperCase());

    if(style === "ribbon"){
      return (
        `<g>` +
          `<path d="M ${x} ${y+40} Q 512 ${y-10} ${x+w} ${y+40} ` +
                 `L ${x+w-40} ${y+92} Q 512 ${y+60} ${x+40} ${y+92} Z" ` +
                `fill="${fill}" stroke="${stroke}" stroke-width="6" />` +
          `<text x="512" y="${y+72}" text-anchor="middle" ` +
                `font-family="${MOTTO_FONT}" font-size="34" font-weight="800" fill="${palette.b}" ` +
                `style="letter-spacing:0.08em;">` +
            `${safe}` +
          `</text>` +
        `</g>`
      );
    }

    if(style === "plaque"){
      return (
        `<g>` +
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" ` +
                `fill="${fill}" stroke="${stroke}" stroke-width="6"/>` +
          `<text x="512" y="${y+74}" text-anchor="middle" ` +
                `font-family="${MOTTO_FONT}" font-size="34" font-weight="900" fill="${palette.b}" ` +
                `style="letter-spacing:0.08em;">` +
            `${safe}` +
          `</text>` +
        `</g>`
      );
    }

    // scroll
    return (
      `<g>` +
        `<path d="M ${x+20} ${y+22} Q ${x} ${y+60} ${x+22} ${y+98} ` +
               `Q ${x+80} ${y+120} ${x+98} ${y+86} ` +
               `Q ${x+112} ${y+58} ${x+90} ${y+34}" ` +
              `fill="rgba(255,255,255,0.10)" stroke="${stroke}" stroke-width="6"/>` +
        `<path d="M ${x+w-20} ${y+22} Q ${x+w} ${y+60} ${x+w-22} ${y+98} ` +
               `Q ${x+w-80} ${y+120} ${x+w-98} ${y+86} ` +
               `Q ${x+w-112} ${y+58} ${x+w-90} ${y+34}" ` +
              `fill="rgba(255,255,255,0.10)" stroke="${stroke}" stroke-width="6"/>` +
        `<rect x="${x+55}" y="${y+20}" width="${w-110}" height="${h-40}" rx="16" ` +
              `fill="${fill}" stroke="${stroke}" stroke-width="6"/>` +
        `<text x="512" y="${y+74}" text-anchor="middle" ` +
              `font-family="${MOTTO_FONT}" font-size="34" font-weight="900" fill="${palette.b}" ` +
              `style="letter-spacing:0.08em;">` +
          `${safe}` +
        `</text>` +
      `</g>`
    );
  }

  // ---------- Shield paths (simple + reliable) ----------
  function shieldPathHeater(x,y,w,h){
    const top = y;
    const left = x, right = x+w;
    const bottom = y+h;
    const mid = x + w/2;

    const neck = y + h*0.22;
    const curve = y + h*0.62;

    return [
      `M ${left+80} ${top+30}`,
      `Q ${mid} ${top-20} ${right-80} ${top+30}`,
      `Q ${right+20} ${neck} ${right-40} ${curve}`,
      `Q ${mid} ${bottom+10} ${left+40} ${curve}`,
      `Q ${left-20} ${neck} ${left+80} ${top+30}`,
      `Z`
    ].join(" ");
  }

  function shieldPathRound(x,y,w,h){
    const cx = x+w/2, cy = y+h*0.48;
    const r = Math.min(w,h)*0.44;
    return `M ${cx} ${y+40}
      A ${r} ${r} 0 1 1 ${cx-0.01} ${y+40}
      Q ${cx} ${y+h+10} ${cx} ${y+h-40}
      Z`.replace(/\s+/g," ");
  }

  function shieldPathKite(x,y,w,h){
    const mid = x+w/2;
    return [
      `M ${x+90} ${y+40}`,
      `Q ${mid} ${y-10} ${x+w-90} ${y+40}`,
      `L ${x+w-40} ${y+h*0.58}`,
      `Q ${mid} ${y+h+20} ${x+40} ${y+h*0.58}`,
      `Z`
    ].join(" ");
  }

  function shieldPathSpanish(x,y,w,h){
    const mid = x+w/2;
    const bottom = y+h;
    return [
      `M ${x+90} ${y+40}`,
      `Q ${mid} ${y-10} ${x+w-90} ${y+40}`,
      `L ${x+w-60} ${y+h*0.70}`,
      `Q ${mid} ${bottom+10} ${x+60} ${y+h*0.70}`,
      `Z`
    ].join(" ");
  }

  function shieldPathGothic(x,y,w,h){
    const mid = x+w/2;
    return [
      `M ${x+110} ${y+70}`,
      `Q ${mid} ${y-40} ${x+w-110} ${y+70}`,
      `Q ${x+w+10} ${y+h*0.30} ${x+w-70} ${y+h*0.72}`,
      `Q ${mid} ${y+h+22} ${x+70} ${y+h*0.72}`,
      `Q ${x-10} ${y+h*0.30} ${x+110} ${y+70}`,
      `Z`
    ].join(" ");
  }

  function shieldPathOval(x,y,w,h){
    const rx = w*0.40, ry = h*0.44;
    const cx = x+w/2, cy = y+h*0.50;
    return `M ${cx} ${cy-ry}
      A ${rx} ${ry} 0 1 1 ${cx-0.01} ${cy-ry}
      Z`.replace(/\s+/g," ");
  }

  // ---------- Sigil drawing (procedural SVG) ----------
  function sigilSword({cx,cy,size}){
    const s = size;
    return {
      base: `
        <path d="M ${cx} ${cy-s*0.72} L ${cx+s*0.06} ${cy-s*0.15} L ${cx-s*0.06} ${cy-s*0.15} Z"></path>
        <rect x="${cx-s*0.06}" y="${cy-s*0.15}" width="${s*0.12}" height="${s*0.62}" rx="${s*0.04}"></rect>
        <rect x="${cx-s*0.28}" y="${cy+s*0.20}" width="${s*0.56}" height="${s*0.10}" rx="${s*0.05}"></rect>
        <rect x="${cx-s*0.07}" y="${cy+s*0.24}" width="${s*0.14}" height="${s*0.22}" rx="${s*0.06}"></rect>
        <circle cx="${cx}" cy="${cy+s*0.50}" r="${s*0.08}"></circle>
      `,
      solid: `
        <path d="M ${cx} ${cy-s*0.72} L ${cx+s*0.06} ${cy-s*0.15} L ${cx-s*0.06} ${cy-s*0.15} Z"></path>
        <rect x="${cx-s*0.06}" y="${cy-s*0.15}" width="${s*0.12}" height="${s*0.62}" rx="${s*0.04}"></rect>
        <rect x="${cx-s*0.28}" y="${cy+s*0.20}" width="${s*0.56}" height="${s*0.10}" rx="${s*0.05}"></rect>
        <rect x="${cx-s*0.07}" y="${cy+s*0.24}" width="${s*0.14}" height="${s*0.22}" rx="${s*0.06}"></rect>
        <circle cx="${cx}" cy="${cy+s*0.50}" r="${s*0.08}"></circle>
      `,
      outline: `
        <path d="M ${cx} ${cy-s*0.72} L ${cx+s*0.06} ${cy-s*0.15} L ${cx-s*0.06} ${cy-s*0.15} Z"></path>
        <path d="M ${cx} ${cy-s*0.15} L ${cx} ${cy+s*0.48}"></path>
        <path d="M ${cx-s*0.28} ${cy+s*0.25} L ${cx+s*0.28} ${cy+s*0.25}"></path>
      `,
      accent: `
        <rect x="${cx-s*0.02}" y="${cy-s*0.10}" width="${s*0.04}" height="${s*0.46}" rx="${s*0.02}"></rect>
      `
    };
  }

  function sigilTwinSwords({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <g transform="rotate(-25 ${cx} ${cy})">${sigilSword({cx,cy,size:s}).solid}</g>
        <g transform="rotate(25 ${cx} ${cy})">${sigilSword({cx,cy,size:s}).solid}</g>
      `,
      outline: `
        <g transform="rotate(-25 ${cx} ${cy})">${sigilSword({cx,cy,size:s}).outline}</g>
        <g transform="rotate(25 ${cx} ${cy})">${sigilSword({cx,cy,size:s}).outline}</g>
      `,
      accent: `
        <circle cx="${cx}" cy="${cy+s*0.45}" r="${s*0.10}"></circle>
      `
    };
  }

  function sigilCrown({cx,cy,size}){
    const s = size;
    const y = cy - s*0.10;
    return {
      solid: `
        <path d="M ${cx-s*0.55} ${y+s*0.30}
                 L ${cx-s*0.40} ${y-s*0.10}
                 L ${cx-s*0.15} ${y+s*0.10}
                 L ${cx} ${y-s*0.22}
                 L ${cx+s*0.15} ${y+s*0.10}
                 L ${cx+s*0.40} ${y-s*0.10}
                 L ${cx+s*0.55} ${y+s*0.30}
                 Z"></path>
        <rect x="${cx-s*0.58}" y="${y+s*0.30}" width="${s*1.16}" height="${s*0.22}" rx="${s*0.08}"></rect>
        <circle cx="${cx-s*0.40}" cy="${y-s*0.10}" r="${s*0.08}"></circle>
        <circle cx="${cx}" cy="${y-s*0.22}" r="${s*0.09}"></circle>
        <circle cx="${cx+s*0.40}" cy="${y-s*0.10}" r="${s*0.08}"></circle>
      `,
      outline: `
        <path d="M ${cx-s*0.55} ${y+s*0.30}
                 L ${cx-s*0.40} ${y-s*0.10}
                 L ${cx-s*0.15} ${y+s*0.10}
                 L ${cx} ${y-s*0.22}
                 L ${cx+s*0.15} ${y+s*0.10}
                 L ${cx+s*0.40} ${y-s*0.10}
                 L ${cx+s*0.55} ${y+s*0.30}
                 Z"></path>
        <path d="M ${cx-s*0.58} ${y+s*0.41} L ${cx+s*0.58} ${y+s*0.41}"></path>
      `,
      accent: `
        <rect x="${cx-s*0.45}" y="${y+s*0.36}" width="${s*0.90}" height="${s*0.10}" rx="${s*0.05}"></rect>
      `
    };
  }

  function sigilTree({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <path d="M ${cx} ${cy-s*0.60}
                 C ${cx+s*0.35} ${cy-s*0.55} ${cx+s*0.40} ${cy-s*0.10} ${cx+s*0.10} ${cy-s*0.02}
                 C ${cx+s*0.30} ${cy+s*0.15} ${cx+s*0.10} ${cy+s*0.42} ${cx} ${cy+s*0.35}
                 C ${cx-s*0.10} ${cy+s*0.42} ${cx-s*0.30} ${cy+s*0.15} ${cx-s*0.10} ${cy-s*0.02}
                 C ${cx-s*0.40} ${cy-s*0.10} ${cx-s*0.35} ${cy-s*0.55} ${cx} ${cy-s*0.60}
                 Z"></path>
        <rect x="${cx-s*0.10}" y="${cy+s*0.20}" width="${s*0.20}" height="${s*0.45}" rx="${s*0.08}"></rect>
      `,
      outline: `
        <path d="M ${cx} ${cy-s*0.60}
                 C ${cx+s*0.35} ${cy-s*0.55} ${cx+s*0.40} ${cy-s*0.10} ${cx+s*0.10} ${cy-s*0.02}
                 C ${cx+s*0.30} ${cy+s*0.15} ${cx+s*0.10} ${cy+s*0.42} ${cx} ${cy+s*0.35}
                 C ${cx-s*0.10} ${cy+s*0.42} ${cx-s*0.30} ${cy+s*0.15} ${cx-s*0.10} ${cy-s*0.02}
                 C ${cx-s*0.40} ${cy-s*0.10} ${cx-s*0.35} ${cy-s*0.55} ${cx} ${cy-s*0.60}
                 Z"></path>
        <path d="M ${cx} ${cy+s*0.20} L ${cx} ${cy+s*0.62}"></path>
      `,
      accent: `
        <circle cx="${cx}" cy="${cy-s*0.18}" r="${s*0.10}"></circle>
        <circle cx="${cx-s*0.18}" cy="${cy-s*0.05}" r="${s*0.07}"></circle>
        <circle cx="${cx+s*0.18}" cy="${cy-s*0.05}" r="${s*0.07}"></circle>
      `
    };
  }

  function sigilWave({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <path d="M ${cx-s*0.60} ${cy+s*0.05}
                 C ${cx-s*0.35} ${cy-s*0.20} ${cx-s*0.10} ${cy-s*0.20} ${cx+s*0.10} ${cy+s*0.05}
                 C ${cx+s*0.30} ${cy+s*0.25} ${cx+s*0.55} ${cy+s*0.25} ${cx+s*0.60} ${cy+s*0.05}
                 L ${cx+s*0.60} ${cy+s*0.42}
                 C ${cx+s*0.35} ${cy+s*0.62} ${cx-s*0.35} ${cy+s*0.62} ${cx-s*0.60} ${cy+s*0.42}
                 Z"></path>
        <circle cx="${cx+s*0.45}" cy="${cy-s*0.02}" r="${s*0.10}"></circle>
      `,
      outline: `
        <path d="M ${cx-s*0.60} ${cy+s*0.05}
                 C ${cx-s*0.35} ${cy-s*0.20} ${cx-s*0.10} ${cy-s*0.20} ${cx+s*0.10} ${cy+s*0.05}
                 C ${cx+s*0.30} ${cy+s*0.25} ${cx+s*0.55} ${cy+s*0.25} ${cx+s*0.60} ${cy+s*0.05}"></path>
        <path d="M ${cx-s*0.60} ${cy+s*0.32}
                 C ${cx-s*0.20} ${cy+s*0.55} ${cx+s*0.20} ${cy+s*0.55} ${cx+s*0.60} ${cy+s*0.32}"></path>
      `,
      accent: `
        <path d="M ${cx-s*0.35} ${cy+s*0.18}
                 C ${cx-s*0.10} ${cy+s*0.02} ${cx+s*0.10} ${cy+s*0.02} ${cx+s*0.35} ${cy+s*0.18}"></path>
      `
    };
  }

  function sigilMountain({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <polygon points="${cx-s*0.62},${cy+s*0.45} ${cx-s*0.10},${cy-s*0.30} ${cx+s*0.18},${cy+s*0.10} ${cx+s*0.48},${cy-s*0.10} ${cx+s*0.72},${cy+s*0.45}"></polygon>
      `,
      outline: `
        <polyline points="${cx-s*0.62},${cy+s*0.45} ${cx-s*0.10},${cy-s*0.30} ${cx+s*0.18},${cy+s*0.10} ${cx+s*0.48},${cy-s*0.10} ${cx+s*0.72},${cy+s*0.45}"></polyline>
      `,
      accent: `
        <polygon points="${cx-s*0.10},${cy-s*0.30} ${cx+s*0.02},${cy-s*0.12} ${cx-s*0.18},${cy-s*0.05}"></polygon>
        <polygon points="${cx+s*0.48},${cy-s*0.10} ${cx+s*0.58},${cy+s*0.02} ${cx+s*0.38},${cy+s*0.06}"></polygon>
      `
    };
  }

  function sigilMoon({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <path d="M ${cx+s*0.20} ${cy-s*0.45}
                 A ${s*0.46} ${s*0.46} 0 1 0 ${cx+s*0.20} ${cy+s*0.45}
                 A ${s*0.34} ${s*0.34} 0 1 1 ${cx+s*0.20} ${cy-s*0.45}
                 Z"></path>
      `,
      outline: `
        <path d="M ${cx+s*0.20} ${cy-s*0.45}
                 A ${s*0.46} ${s*0.46} 0 1 0 ${cx+s*0.20} ${cy+s*0.45}"></path>
        <path d="M ${cx+s*0.20} ${cy-s*0.45}
                 A ${s*0.34} ${s*0.34} 0 1 1 ${cx+s*0.20} ${cy+s*0.45}"></path>
      `,
      accent: `
        <circle cx="${cx-s*0.12}" cy="${cy-s*0.08}" r="${s*0.06}"></circle>
        <circle cx="${cx+s*0.10}" cy="${cy+s*0.12}" r="${s*0.04}"></circle>
      `
    };
  }

  function sigilSun({cx,cy,size}){
    const s = size;
    let rays = "";
    for(let i=0;i<12;i++){
      const a = (Math.PI*2*i)/12;
      const x1 = cx + Math.cos(a)*s*0.36;
      const y1 = cy + Math.sin(a)*s*0.36;
      const x2 = cx + Math.cos(a)*s*0.56;
      const y2 = cy + Math.sin(a)*s*0.56;
      rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
    }
    return {
      solid: `
        <circle cx="${cx}" cy="${cy}" r="${s*0.30}"></circle>
        <g stroke="rgba(0,0,0,0.55)" stroke-width="8" stroke-linecap="round" fill="none">${rays}</g>
      `,
      outline: `
        <circle cx="${cx}" cy="${cy}" r="${s*0.30}"></circle>
        <g>${rays}</g>
      `,
      accent: `
        <circle cx="${cx}" cy="${cy}" r="${s*0.14}"></circle>
      `
    };
  }

  function sigilEye({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <path d="M ${cx-s*0.62} ${cy}
                 Q ${cx} ${cy-s*0.45} ${cx+s*0.62} ${cy}
                 Q ${cx} ${cy+s*0.45} ${cx-s*0.62} ${cy}
                 Z"></path>
        <circle cx="${cx}" cy="${cy}" r="${s*0.16}"></circle>
      `,
      outline: `
        <path d="M ${cx-s*0.62} ${cy}
                 Q ${cx} ${cy-s*0.45} ${cx+s*0.62} ${cy}
                 Q ${cx} ${cy+s*0.45} ${cx-s*0.62} ${cy}"></path>
        <circle cx="${cx}" cy="${cy}" r="${s*0.16}"></circle>
      `,
      accent: `<circle cx="${cx}" cy="${cy}" r="${s*0.07}"></circle>`
    };
  }

  function sigilAnchor({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <circle cx="${cx}" cy="${cy-s*0.42}" r="${s*0.10}"></circle>
        <rect x="${cx-s*0.05}" y="${cy-s*0.32}" width="${s*0.10}" height="${s*0.70}" rx="${s*0.05}"></rect>
        <path d="M ${cx-s*0.42} ${cy+s*0.05}
                 Q ${cx} ${cy+s*0.42} ${cx+s*0.42} ${cy+s*0.05}
                 L ${cx+s*0.34} ${cy+s*0.00}
                 Q ${cx} ${cy+s*0.30} ${cx-s*0.34} ${cy+s*0.00}
                 Z"></path>
        <rect x="${cx-s*0.35}" y="${cy-s*0.10}" width="${s*0.70}" height="${s*0.10}" rx="${s*0.05}"></rect>
      `,
      outline: `
        <circle cx="${cx}" cy="${cy-s*0.42}" r="${s*0.10}"></circle>
        <path d="M ${cx} ${cy-s*0.32} L ${cx} ${cy+s*0.40}"></path>
        <path d="M ${cx-s*0.42} ${cy+s*0.05}
                 Q ${cx} ${cy+s*0.42} ${cx+s*0.42} ${cy+s*0.05}"></path>
        <path d="M ${cx-s*0.35} ${cy-s*0.05} L ${cx+s*0.35} ${cy-s*0.05}"></path>
      `,
      accent: `<circle cx="${cx}" cy="${cy+s*0.18}" r="${s*0.07}"></circle>`
    };
  }

  function sigilBook({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <path d="M ${cx-s*0.50} ${cy-s*0.35}
                 Q ${cx-s*0.15} ${cy-s*0.45} ${cx} ${cy-s*0.28}
                 Q ${cx+s*0.15} ${cy-s*0.45} ${cx+s*0.50} ${cy-s*0.35}
                 L ${cx+s*0.50} ${cy+s*0.38}
                 Q ${cx+s*0.15} ${cy+s*0.28} ${cx} ${cy+s*0.45}
                 Q ${cx-s*0.15} ${cy+s*0.28} ${cx-s*0.50} ${cy+s*0.38}
                 Z"></path>
        <rect x="${cx-s*0.03}" y="${cy-s*0.30}" width="${s*0.06}" height="${s*0.70}" rx="${s*0.03}"></rect>
      `,
      outline: `
        <path d="M ${cx-s*0.50} ${cy-s*0.35}
                 Q ${cx-s*0.15} ${cy-s*0.45} ${cx} ${cy-s*0.28}
                 Q ${cx+s*0.15} ${cy-s*0.45} ${cx+s*0.50} ${cy-s*0.35}
                 L ${cx+s*0.50} ${cy+s*0.38}
                 Q ${cx+s*0.15} ${cy+s*0.28} ${cx} ${cy+s*0.45}
                 Q ${cx-s*0.15} ${cy+s*0.28} ${cx-s*0.50} ${cy+s*0.38}
                 Z"></path>
        <path d="M ${cx} ${cy-s*0.28} L ${cx} ${cy+s*0.45}"></path>
      `,
      accent: `
        <rect x="${cx-s*0.40}" y="${cy-s*0.18}" width="${s*0.18}" height="${s*0.06}" rx="${s*0.03}"></rect>
        <rect x="${cx+s*0.22}" y="${cy-s*0.18}" width="${s*0.18}" height="${s*0.06}" rx="${s*0.03}"></rect>
      `
    };
  }

  function sigilRuneKnot({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <path d="M ${cx} ${cy-s*0.55}
                 C ${cx+s*0.35} ${cy-s*0.55} ${cx+s*0.55} ${cy-s*0.35} ${cx+s*0.55} ${cy}
                 C ${cx+s*0.55} ${cy+s*0.35} ${cx+s*0.35} ${cy+s*0.55} ${cx} ${cy+s*0.55}
                 C ${cx-s*0.35} ${cy+s*0.55} ${cx-s*0.55} ${cy+s*0.35} ${cx-s*0.55} ${cy}
                 C ${cx-s*0.55} ${cy-s*0.35} ${cx-s*0.35} ${cy-s*0.55} ${cx} ${cy-s*0.55}
                 Z"></path>
        <path d="M ${cx} ${cy-s*0.30}
                 C ${cx+s*0.18} ${cy-s*0.30} ${cx+s*0.30} ${cy-s*0.18} ${cx+s*0.30} ${cy}
                 C ${cx+s*0.30} ${cy+s*0.18} ${cx+s*0.18} ${cy+s*0.30} ${cx} ${cy+s*0.30}
                 C ${cx-s*0.18} ${cy+s*0.30} ${cx-s*0.30} ${cy+s*0.18} ${cx-s*0.30} ${cy}
                 C ${cx-s*0.30} ${cy-s*0.18} ${cx-s*0.18} ${cy-s*0.30} ${cx} ${cy-s*0.30}
                 Z" opacity="0.55"></path>
      `,
      outline: `
        <path d="M ${cx} ${cy-s*0.55}
                 C ${cx+s*0.35} ${cy-s*0.55} ${cx+s*0.55} ${cy-s*0.35} ${cx+s*0.55} ${cy}
                 C ${cx+s*0.55} ${cy+s*0.35} ${cx+s*0.35} ${cy+s*0.55} ${cx} ${cy+s*0.55}
                 C ${cx-s*0.35} ${cy+s*0.55} ${cx-s*0.55} ${cy+s*0.35} ${cx-s*0.55} ${cy}
                 C ${cx-s*0.55} ${cy-s*0.35} ${cx-s*0.35} ${cy-s*0.55} ${cx} ${cy-s*0.55}"></path>
      `,
      accent: `
        <circle cx="${cx}" cy="${cy}" r="${s*0.10}"></circle>
      `
    };
  }

  function sigilStagSimple({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <path d="M ${cx} ${cy+s*0.45}
                 Q ${cx-s*0.18} ${cy+s*0.20} ${cx-s*0.10} ${cy-s*0.05}
                 Q ${cx-s*0.06} ${cy-s*0.30} ${cx} ${cy-s*0.38}
                 Q ${cx+s*0.06} ${cy-s*0.30} ${cx+s*0.10} ${cy-s*0.05}
                 Q ${cx+s*0.18} ${cy+s*0.20} ${cx} ${cy+s*0.45}
                 Z"></path>
        <path d="M ${cx-s*0.06} ${cy-s*0.34}
                 Q ${cx-s*0.28} ${cy-s*0.44} ${cx-s*0.34} ${cy-s*0.62}
                 Q ${cx-s*0.22} ${cy-s*0.56} ${cx-s*0.16} ${cy-s*0.50}
                 Q ${cx-s*0.20} ${cy-s*0.68} ${cx-s*0.34} ${cy-s*0.78}
                 Q ${cx-s*0.12} ${cy-s*0.76} ${cx-s*0.02} ${cy-s*0.62}
                 Q ${cx-s*0.04} ${cy-s*0.52} ${cx-s*0.06} ${cy-s*0.44}
                 Z"></path>
        <path d="M ${cx+s*0.06} ${cy-s*0.34}
                 Q ${cx+s*0.28} ${cy-s*0.44} ${cx+s*0.34} ${cy-s*0.62}
                 Q ${cx+s*0.22} ${cy-s*0.56} ${cx+s*0.16} ${cy-s*0.50}
                 Q ${cx+s*0.20} ${cy-s*0.68} ${cx+s*0.34} ${cy-s*0.78}
                 Q ${cx+s*0.12} ${cy-s*0.76} ${cx+s*0.02} ${cy-s*0.62}
                 Q ${cx+s*0.04} ${cy-s*0.52} ${cx+s*0.06} ${cy-s*0.44}
                 Z"></path>
      `,
      outline: `
        <path d="M ${cx} ${cy+s*0.45}
                 Q ${cx-s*0.18} ${cy+s*0.20} ${cx-s*0.10} ${cy-s*0.05}
                 Q ${cx-s*0.06} ${cy-s*0.30} ${cx} ${cy-s*0.38}
                 Q ${cx+s*0.06} ${cy-s*0.30} ${cx+s*0.10} ${cy-s*0.05}
                 Q ${cx+s*0.18} ${cy+s*0.20} ${cx} ${cy+s*0.45}"></path>
        <path d="M ${cx-s*0.06} ${cy-s*0.34}
                 Q ${cx-s*0.28} ${cy-s*0.44} ${cx-s*0.34} ${cy-s*0.62}
                 Q ${cx-s*0.20} ${cy-s*0.68} ${cx-s*0.34} ${cy-s*0.78}"></path>
        <path d="M ${cx+s*0.06} ${cy-s*0.34}
                 Q ${cx+s*0.28} ${cy-s*0.44} ${cx+s*0.34} ${cy-s*0.62}
                 Q ${cx+s*0.20} ${cy-s*0.68} ${cx+s*0.34} ${cy-s*0.78}"></path>
      `,
      accent: `
        <circle cx="${cx}" cy="${cy-s*0.08}" r="${s*0.05}"></circle>
      `
    };
  }

  function sigilFlame({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <path d="M ${cx} ${cy-s*0.60}
                 C ${cx+s*0.20} ${cy-s*0.40} ${cx+s*0.32} ${cy-s*0.18} ${cx+s*0.20} ${cy+s*0.05}
                 C ${cx+s*0.10} ${cy+s*0.30} ${cx-s*0.10} ${cy+s*0.45} ${cx} ${cy+s*0.55}
                 C ${cx-s*0.10} ${cy+s*0.45} ${cx-s*0.32} ${cy+s*0.30} ${cx-s*0.20} ${cy+s*0.05}
                 C ${cx-s*0.05} ${cy-s*0.10} ${cx+s*0.05} ${cy-s*0.22} ${cx} ${cy-s*0.60}
                 Z"></path>
      `,
      outline: `
        <path d="M ${cx} ${cy-s*0.60}
                 C ${cx+s*0.20} ${cy-s*0.40} ${cx+s*0.32} ${cy-s*0.18} ${cx+s*0.20} ${cy+s*0.05}
                 C ${cx+s*0.10} ${cy+s*0.30} ${cx-s*0.10} ${cy+s*0.45} ${cx} ${cy+s*0.55}
                 C ${cx-s*0.10} ${cy+s*0.45} ${cx-s*0.32} ${cy+s*0.30} ${cx-s*0.20} ${cy+s*0.05}
                 C ${cx-s*0.05} ${cy-s*0.10} ${cx+s*0.05} ${cy-s*0.22} ${cx} ${cy-s*0.60}"></path>
      `,
      accent: `
        <path d="M ${cx} ${cy-s*0.25}
                 C ${cx+s*0.10} ${cy-s*0.12} ${cx+s*0.12} ${cy+s*0.05} ${cx} ${cy+s*0.15}
                 C ${cx-s*0.12} ${cy+s*0.05} ${cx-s*0.10} ${cy-s*0.12} ${cx} ${cy-s*0.25}
                 Z"></path>
      `
    };
  }

  function sigilMiniShield({cx,cy,size}){
    const s = size;
    const d = shieldPathHeater(cx - s*0.45, cy - s*0.48, s*0.90, s*0.95);
    return {
      solid: `<path d="${d}"></path>`,
      outline: `<path d="${d}"></path>`,
      accent: `<path d="${d}" opacity="0.35"></path>`
    };
  }

  function sigilCompass({cx,cy,size}){
    const s = size;
    return {
      solid: `
        <circle cx="${cx}" cy="${cy}" r="${s*0.34}"></circle>
        <polygon points="${cx},${cy-s*0.58} ${cx+s*0.10},${cy-s*0.08} ${cx},${cy+s*0.10} ${cx-s*0.10},${cy-s*0.08}"></polygon>
        <polygon points="${cx},${cy+s*0.58} ${cx+s*0.10},${cy+s*0.08} ${cx},${cy-s*0.10} ${cx-s*0.10},${cy+s*0.08}" opacity="0.65"></polygon>
      `,
      outline: `
        <circle cx="${cx}" cy="${cy}" r="${s*0.34}"></circle>
        <line x1="${cx}" y1="${cy-s*0.58}" x2="${cx}" y2="${cy+s*0.58}"></line>
        <line x1="${cx-s*0.58}" y1="${cy}" x2="${cx+s*0.58}" y2="${cy}"></line>
      `,
      accent: `<circle cx="${cx}" cy="${cy}" r="${s*0.12}"></circle>`
    };
  }

  crest.draw = {
    /* The crest as SVG text. options.size sets the width and height (the PNG
       uses 2048); options.fontDataUrl packs the motto font into the picture. */
    svg: draw,
    shieldIds: SHIELDS.map(s => s.id),
    sigilIds: SIGILS.map(s => s.id),
    MOTTO_FONT: MOTTO_FONT
  };
})();
