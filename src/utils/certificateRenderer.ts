import { parseFontForCanvas } from './fontHelper';

const getBgHash = (bg: string) => {
  if (!bg || typeof bg !== 'string') return '';
  return bg.length > 200 ? `hash_${bg.length}_${bg.slice(-30)}` : bg;
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export const loadCertificateImage = (url: string): Promise<HTMLImageElement> => {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback
      if (url !== '/certificate_1.jpg' && url !== '/certificate_2.jpg') {
        const fallback = new Image();
        fallback.crossOrigin = 'anonymous';
        fallback.onload = () => resolve(fallback);
        fallback.onerror = (err) => reject(err);
        fallback.src = '/certificate_1.jpg';
      } else {
        reject(new Error(`Failed to load certificate background: ${url}`));
      }
    };
    img.src = url;
  });

  imageCache.set(url, promise);
  return promise;
};

export const preloadCertificateImages = (eventSettings?: any) => {
  const urls = [
    '/certificate_1.jpg',
    '/certificate_2.jpg',
    eventSettings?.certTheme1Url,
    eventSettings?.certTheme2Url,
    eventSettings?.certTheme3Url
  ].filter(Boolean) as string[];

  urls.forEach(u => loadCertificateImage(u).catch(() => {}));
};

const fillMultiLineCanvasText = (
  ctx: CanvasRenderingContext2D,
  rawText: string,
  x: number,
  y: number,
  fontSize: number,
  fontStyle: string,
  color: string,
  transformUpper: boolean = true,
  align: CanvasTextAlign = 'center'
) => {
  ctx.fillStyle = color;
  ctx.font = fontStyle;
  ctx.textAlign = align;
  ctx.textBaseline = 'bottom';

  const textStr = transformUpper ? (rawText || '').toUpperCase() : (rawText || '');
  const lines = textStr.split('\n').filter(Boolean);
  if (lines.length <= 1) {
    ctx.fillText(lines[0] || '', x, y);
    return;
  }
  const lineGap = fontSize * 1.15;
  const startY = y - ((lines.length - 1) * lineGap);
  lines.forEach((line, i) => {
    ctx.fillText(line, x, startY + i * lineGap);
  });
};

export interface RenderCertificateParams {
  participantName: string;
  competitionName: string;
  competitionId?: string;
  rank: number;
  eventSettings?: any;
}

export const renderCertificateToBlob = async ({
  participantName,
  competitionName,
  competitionId,
  rank,
  eventSettings
}: RenderCertificateParams): Promise<{ blob: Blob; fileName: string }> => {
  const activeBg = rank === 1 
      ? eventSettings?.certTheme1Url 
      : rank === 2 
        ? eventSettings?.certTheme2Url 
        : eventSettings?.certTheme3Url;
  const fallbackBg = rank === 1 ? '/certificate_1.jpg' : rank === 2 ? '/certificate_2.jpg' : '/certificate_3.jpg';
  const resolvedBg = activeBg || fallbackBg;

  const img = await loadCertificateImage(resolvedBg);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Draw background image
  ctx.drawImage(img, 0, 0, img.width, img.height);
  const centerX = img.width / 2;

  // Resolve template styling
  const compKey = `${competitionId || competitionName}_${rank}`;
  const compSpecificConfig = eventSettings?.certificateTemplateConfig?.[compKey];
  const globalRankConfig = eventSettings?.certificateTemplateConfig?.[rank] || {};

  const isCompValid = compSpecificConfig && (!compSpecificConfig._savedBgImageUrl || compSpecificConfig._savedBgImageUrl === getBgHash(resolvedBg));
  const isGlobalValid = globalRankConfig && (!globalRankConfig._savedBgImageUrl || globalRankConfig._savedBgImageUrl === getBgHash(resolvedBg));
  const templateConfig = (isCompValid ? compSpecificConfig : null) || (isGlobalValid ? globalRankConfig : null) || globalRankConfig || {};

  const nameX = templateConfig.nameX ?? (rank === 1 ? -151 : -125);
  const nameY = templateConfig.nameY ?? (rank === 1 ? 461 : 461);
  const compX = templateConfig.compX ?? (rank === 1 ? -37 : -30);
  const compY = templateConfig.compY ?? (rank === 1 ? 553 : 553);
  const nameSize = templateConfig.nameSize ?? (rank === 1 ? 33 : 33);
  const compSize = templateConfig.compSize ?? (rank === 1 ? 25 : 25);
  const nameFont = templateConfig.nameFont || '"Montserrat", "Inter", sans-serif';
  const compFont = templateConfig.compFont || '"Montserrat", "Inter", sans-serif';
  const defaultColor = rank === 1 ? '#cc0000' : '#000000';
  const nameColor = templateConfig.nameColor ?? defaultColor;
  const compColor = templateConfig.compColor ?? defaultColor;
  const nameAlign: 'left' | 'center' = templateConfig.nameAlign || 'left';
  const compAlign: 'left' | 'center' = templateConfig.compAlign || 'left';

  // Custom text overrides if any
  const overrides = eventSettings?.certificateOverrides || {};
  const customCompName = overrides[`comp_${competitionId || competitionName}`] || overrides[`comp_${competitionName}`] || competitionName;
  const customParticipantName = overrides[`${compKey}_${participantName}`] || participantName;

  // Draw Participant Name
  fillMultiLineCanvasText(
    ctx,
    customParticipantName || 'PARTICIPANT NAME',
    centerX + nameX,
    nameY,
    nameSize,
    parseFontForCanvas(nameFont, nameSize, 'bold'),
    nameColor,
    true,
    nameAlign
  );

  // Draw Competition Name
  fillMultiLineCanvasText(
    ctx,
    customCompName || 'COMPETITION',
    centerX + compX,
    compY,
    compSize,
    parseFontForCanvas(compFont, compSize, 'bold'),
    compColor,
    true,
    compAlign
  );

  const cleanName = (customParticipantName || 'Participant').replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
  const cleanComp = (customCompName || 'Competition').replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
  const fileName = `${cleanComp}_Rank${rank}_${cleanName}.jpg`;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, fileName });
        } else {
          reject(new Error('Failed to create certificate blob'));
        }
      },
      'image/jpeg',
      0.95
    );
  });
};
