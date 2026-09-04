export interface FontOption {
  label: string;
  value: string;
}

export const UNIVERSAL_FONT_OPTIONS: FontOption[] = [
  // --- POPPINS FAMILY ---
  { label: 'Poppins (Thin 200)', value: 'thin "Poppins", sans-serif' },
  { label: 'Poppins (Regular 400)', value: '400 "Poppins", sans-serif' },
  { label: 'Poppins (Medium 500)', value: 'medium "Poppins", sans-serif' },
  { label: 'Poppins (Semi Bold 600)', value: 'semibold "Poppins", sans-serif' },
  { label: 'Poppins (Bold 700)', value: 'bold "Poppins", sans-serif' },
  { label: 'Poppins (Italic)', value: 'italic 400 "Poppins", sans-serif' },
  { label: 'Poppins (Italic Bold)', value: 'italic bold "Poppins", sans-serif' },

  // --- GOTHAM FAMILY ---
  { label: 'Gotham (Thin 200)', value: 'thin "Gotham", "Montserrat", sans-serif' },
  { label: 'Gotham (Regular 400)', value: '400 "Gotham", "Montserrat", sans-serif' },
  { label: 'Gotham (Medium 500)', value: 'medium "Gotham", "Montserrat", sans-serif' },
  { label: 'Gotham (Semi Bold 600)', value: 'semibold "Gotham", "Montserrat", sans-serif' },
  { label: 'Gotham (Bold 700)', value: 'bold "Gotham", "Montserrat", sans-serif' },
  { label: 'Gotham (Italic)', value: 'italic 400 "Gotham", "Montserrat", sans-serif' },
  { label: 'Gotham (Italic Bold)', value: 'italic bold "Gotham", "Montserrat", sans-serif' },

  // --- HELVETICA FAMILY ---
  { label: 'Helvetica (Thin 200)', value: 'thin "Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Helvetica (Regular 400)', value: '400 "Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Helvetica (Medium 500)', value: 'medium "Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Helvetica (Semi Bold 600)', value: 'semibold "Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Helvetica (Bold 700)', value: 'bold "Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Helvetica (Italic)', value: 'italic 400 "Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Helvetica (Italic Bold)', value: 'italic bold "Helvetica Neue", Helvetica, Arial, sans-serif' },

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
  const weightMatch = family.match(/\b(100|200|300|400|500|600|700|800|900|bold|normal|thin|medium|semibold)\b/i);
  if (weightMatch) {
    const w = weightMatch[1].toLowerCase();
    if (w === 'thin') weight = '200';
    else if (w === 'medium') weight = '500';
    else if (w === 'semibold') weight = '600';
    else if (w === 'bold') weight = '700';
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

  const weightMatch = family.match(/\b(100|200|300|400|500|600|700|800|900|bold|normal|thin|medium|semibold)\b/i);
  if (weightMatch) {
    const w = weightMatch[1].toLowerCase();
    if (w === 'thin') fontWeight = '200';
    else if (w === 'medium') fontWeight = '500';
    else if (w === 'semibold') fontWeight = '600';
    else if (w === 'bold') fontWeight = '700';
    else if (w === 'normal') fontWeight = '400';
    else fontWeight = w;
    family = family.replace(weightMatch[0], '').trim();
  }

  family = family.replace(/^[\s,]+/, '').trim() || defaultFamily;
  return { fontStyle, fontWeight, fontFamily: family };
}
