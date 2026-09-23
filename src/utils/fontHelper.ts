export interface FontOption {
  label: string;
  value: string;
}

export const UNIVERSAL_FONT_OPTIONS: FontOption[] = [
  // --- SORA FAMILY (Google Fonts - Standard for Competition & Result No.) ---
  { label: 'Sora (Semi Bold 600 - Standard Result No. & Comp Name)', value: '600 "Sora", sans-serif' },
  { label: 'Sora (Light 300 - Standard Category)', value: '300 "Sora", sans-serif' },
  { label: 'Sora (Regular 400)', value: '400 "Sora", sans-serif' },
  { label: 'Sora (Medium 500)', value: '500 "Sora", sans-serif' },
  { label: 'Sora (Bold 700)', value: 'bold "Sora", sans-serif' },
  { label: 'Sora (Extra Bold 800)', value: '800 "Sora", sans-serif' },
  { label: 'Sora (Extra Light 200)', value: '200 "Sora", sans-serif' },

  // --- FRACTUL ALT FAMILY (Standard for Winners, Units & Ranks) ---
  { label: 'Fractul Alt (Medium 500 - Official Poster Winners & Teams)', value: '500 "Fractul Alt", sans-serif' },
  { label: 'Fractul Alt (Semi Bold 600 - Prominent Title/Winner)', value: '600 "Fractul Alt", sans-serif' },
  { label: 'Fractul Alt (Regular 400 - Clean & Crisp)', value: '400 "Fractul Alt", sans-serif' },
  { label: 'Fractul Alt (Bold 700 - Strong Display)', value: '700 "Fractul Alt", sans-serif' },
  { label: 'Fractul Alt (Extra Bold 800 - Heavy Block)', value: '800 "Fractul Alt", sans-serif' },
  { label: 'Fractul Alt (Light / Hairline 200)', value: '200 "Fractul Alt", sans-serif' },

  // --- THUNDER FAMILY ---
  { label: 'Thunder ExtraLight LC', value: '200 "Thunder ExtraLight LC", "Thunder", sans-serif' },

  // --- POPPINS FAMILY ---
  { label: 'Poppins (Thin 200)', value: 'thin "Poppins", sans-serif' },
  { label: 'Poppins (Regular 400)', value: '400 "Poppins", sans-serif' },
  { label: 'Poppins (Medium 500)', value: 'medium "Poppins", sans-serif' },
  { label: 'Poppins (Semi Bold 600)', value: 'semibold "Poppins", sans-serif' },
  { label: 'Poppins (Bold 700)', value: 'bold "Poppins", sans-serif' },
  { label: 'Poppins (Italic)', value: 'italic 400 "Poppins", sans-serif' },
  { label: 'Poppins (Italic Bold)', value: 'italic bold "Poppins", sans-serif' },

  // --- MONTSERRAT FAMILY ---
  { label: 'Montserrat (Thin 200)', value: 'thin "Montserrat", sans-serif' },
  { label: 'Montserrat (Regular 400)', value: '400 "Montserrat", sans-serif' },
  { label: 'Montserrat (Medium 500)', value: 'medium "Montserrat", sans-serif' },
  { label: 'Montserrat (Semi Bold 600)', value: 'semibold "Montserrat", sans-serif' },
  { label: 'Montserrat (Bold 700)', value: 'bold "Montserrat", sans-serif' },
  { label: 'Montserrat (Italic)', value: 'italic 400 "Montserrat", sans-serif' },
  { label: 'Montserrat (Italic Bold)', value: 'italic bold "Montserrat", sans-serif' },

  // --- OTHER CLASSIC FONTS ---
  { label: 'Inter (Sans)', value: 'Inter, sans-serif' },
  { label: 'Outfit (Geometric Sans)', value: 'Outfit, sans-serif' },
  { label: 'Roboto (Sans)', value: 'Roboto, sans-serif' },
  { label: 'Hochland (Rendezvous Display)', value: 'bold "Hochland", sans-serif' },
  { label: 'Playfair Display (Luxury Serif)', value: '"Playfair Display", serif' },
  { label: 'Cinzel (Classical Elegant Serif)', value: 'Cinzel, serif' },
  { label: 'Cairo (Arabic / Modern)', value: "'Cairo', sans-serif" },
  { label: 'Amiri (Arabic / Classic)', value: "'Amiri', serif" },
  { label: 'Oswald (Tall Display)', value: 'Oswald, sans-serif' },
  { label: 'Courier New (Monospace)', value: '"Courier New", monospace' },
  { label: 'Georgia (Editorial Serif)', value: 'Georgia, serif' },
  { label: 'Great Vibes (Script Signature)', value: '"Great Vibes", cursive' },
  { label: 'Alex Brush (Script)', value: '"Alex Brush", cursive' },
  { label: 'Pinyon Script (Classic Script)', value: '"Pinyon Script", cursive' }
];

/**
 * Parses font string for HTML5 Canvas ctx.font
 * Output format: "[style] [weight] [size]px [family]"
 */
export function parseFontForCanvas(
  fontVal?: string,
  defaultSize: number = 32,
  defaultWeight: string | number = '700'
): string {
  if (!fontVal) return `${defaultWeight} ${defaultSize}px sans-serif`;

  let isItalic = false;
  let weight = defaultWeight.toString();
  let family = fontVal.toString().trim();

  // Detect italic
  if (/\bitalic\b/i.test(family)) {
    isItalic = true;
    family = family.replace(/\bitalic\b/gi, '').trim();
  }

  // Detect weight keywords / numbers
  const weightMatch = family.match(/\b(100|200|300|400|500|600|700|800|900|bold|normal|thin|extralight|light|medium|semibold|extrabold)\b/i);
  if (weightMatch) {
    const w = weightMatch[1].toLowerCase();
    if (w === 'thin' || w === 'extralight') weight = '200';
    else if (w === 'light') weight = '300';
    else if (w === 'medium') weight = '500';
    else if (w === 'semibold') weight = '600';
    else if (w === 'bold') weight = '700';
    else if (w === 'extrabold') weight = '800';
    else if (w === 'normal') weight = '400';
    else weight = w;
    family = family.replace(weightMatch[0], '').trim();
  }

  // Clean leading commas/spaces
  family = family.replace(/^[\s,]+/, '').trim() || 'sans-serif';

  const stylePrefix = isItalic ? 'italic ' : '';
  return `${stylePrefix}${weight} ${defaultSize}px ${family}`;
}

/**
 * Parses font string for SVG text rendering
 */
export function parseFontForSvg(
  fontVal?: string,
  defaultWeight: string = '700',
  defaultFamily: string = 'Inter, sans-serif'
): { fontStyle: string; fontWeight: string; fontFamily: string } {
  if (!fontVal) return { fontStyle: 'normal', fontWeight: defaultWeight, fontFamily: defaultFamily };

  let fontStyle = 'normal';
  let fontWeight = defaultWeight;
  let family = fontVal.toString().trim();

  if (/\bitalic\b/i.test(family)) {
    fontStyle = 'italic';
    family = family.replace(/\bitalic\b/gi, '').trim();
  }

  const weightMatch = family.match(/\b(100|200|300|400|500|600|700|800|900|bold|normal|thin|extralight|light|medium|semibold|extrabold)\b/i);
  if (weightMatch) {
    const w = weightMatch[1].toLowerCase();
    if (w === 'thin' || w === 'extralight') fontWeight = '200';
    else if (w === 'light') fontWeight = '300';
    else if (w === 'medium') fontWeight = '500';
    else if (w === 'semibold') fontWeight = '600';
    else if (w === 'bold') fontWeight = '700';
    else if (w === 'extrabold') fontWeight = '800';
    else if (w === 'normal') fontWeight = '400';
    else fontWeight = w;
    family = family.replace(weightMatch[0], '').trim();
  }

  family = family.replace(/^[\s,]+/, '').trim() || defaultFamily;
  return { fontStyle, fontWeight, fontFamily: family };
}
