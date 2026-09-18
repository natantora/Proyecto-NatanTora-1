import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type SeatingChartPdfSeat = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  holderName: string;
};

type Point = { x: number; y: number };

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 2.5;

// The production chair coordinates were placed over a 1000 x 600 canvas.
// Keeping that exact coordinate system makes the generated PDF match the
// approved operational plan used by the Midrash.
const PLAN_WIDTH_UNITS = 1000;
const PLAN_HEIGHT_UNITS = 600;

const NAVY = rgb(7 / 255, 26 / 255, 53 / 255);
const WHITE = rgb(1, 1, 1);

const NAME_OVERRIDES: Record<string, string[]> = {
  "ANITA CHAYO CHALOM": ["ANITA", "CHAYO C."],
  "CARLOS CHAYO COHEN": ["CARLOS", "CHAYO C."],
  "MARCOS MICHAN ASQUENAZI": ["MARCOS", "MICHAN"],
  "MICHAN ASQUENAZI": ["MICHAN", "ASQ."],
  "SUSY ESQUENAZI": ["SUSY", "ESQ."],
  "FAMILIA MARCOS": ["FAM.", "MARCOS"],
  "ISAAC BENZAQUEN": ["ISAAC", "BENZ."],
  "JHONATHAN CHAYO": ["JHON.", "CHAYO"],
  "DAVID ASKENAZI": ["DAVID", "ASKEN."],
  "RAFA ASQUENAZI": ["RAFA", "ASQ."],
  "JACO ASQUENAZI": ["JACO", "ASQ."],
  "ZURY CHAYO HILU": ["ZURY", "CHAYO H."],
  "LUGARES HOMBRES": ["HOMBRES"],
};

export async function createSeatingChartPdf(params: {
  eventTitle: string;
  planPng: Uint8Array;
  seats: SeatingChartPdfSeat[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${params.eventTitle} - plano con nombres`);
  pdf.setAuthor("Midrash Natan Tora");
  pdf.setSubject("Plano de asientos con nombres por lugar");

  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const plan = await pdf.embedPng(params.planPng);

  page.drawRectangle({ x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT, color: WHITE });

  const planWidth = A4_HEIGHT - PAGE_MARGIN * 2;
  const planHeight = A4_WIDTH - PAGE_MARGIN * 2;
  page.drawImage(plan, {
    x: PAGE_MARGIN,
    y: A4_HEIGHT - PAGE_MARGIN,
    width: planWidth,
    height: planHeight,
    rotate: degrees(-90),
  });

  const scaleX = planWidth / PLAN_WIDTH_UNITS;
  const scaleY = planHeight / PLAN_HEIGHT_UNITS;
  for (const seat of params.seats) {
    drawSeatName(page, font, seat, scaleX, scaleY, planWidth, planHeight);
  }

  return pdf.save();
}

function drawSeatName(
  page: PDFPage,
  font: PDFFont,
  seat: SeatingChartPdfSeat,
  scaleX: number,
  scaleY: number,
  planWidth: number,
  planHeight: number,
) {
  const lines = compactName(seat.holderName);
  const labelAngle = readableAngle(seat.rotation);
  const verticalChair = Math.abs(labelAngle) === 90;
  const maxWidth = (verticalChair ? 13.4 * scaleY : 18 * scaleX) - 2;
  const maxHeight = (verticalChair ? 18 * scaleX : 13.4 * scaleY) - 1.8;
  const fontSize = fitFont(font, lines, maxWidth, maxHeight);
  const lineHeight = fontSize * 0.92;
  const glyphHeight = fontSize * 0.925;
  const totalHeight = glyphHeight + (lines.length - 1) * lineHeight;
  const firstBaseline = totalHeight / 2 - fontSize * 0.718;

  // The selectable point is 20 plan units away from the visual chair center.
  const localX = seat.x * scaleX;
  const localY = planHeight - (seat.y - 20) * scaleY;
  const centerX = PAGE_MARGIN + localY;
  const centerY = PAGE_MARGIN + planWidth - localX;
  const finalAngle = labelAngle - 90;

  // Match the approved reference: each reservation is printed inside a clean
  // white chair label with a thin navy outline, without any page furniture.
  const boxWidth = maxWidth + 2;
  const boxHeight = maxHeight + 1.8;
  const boxOrigin = rotateLocalPoint(-boxWidth / 2, -boxHeight / 2, finalAngle, centerX, centerY);
  page.drawRectangle({
    x: boxOrigin.x,
    y: boxOrigin.y,
    width: boxWidth,
    height: boxHeight,
    rotate: degrees(finalAngle),
    color: WHITE,
    borderColor: NAVY,
    borderWidth: 0.45,
  });

  lines.forEach((line, index) => {
    const baseline = firstBaseline - index * lineHeight;
    const width = font.widthOfTextAtSize(line, fontSize);
    const halo = 0.22;
    for (const [offsetX, offsetY] of [[-halo, 0], [halo, 0], [0, -halo], [0, halo]] as const) {
      const point = rotateLocalPoint(-width / 2 + offsetX, baseline + offsetY, finalAngle, centerX, centerY);
      page.drawText(line, { x: point.x, y: point.y, size: fontSize, font, color: WHITE, rotate: degrees(finalAngle) });
    }
    const point = rotateLocalPoint(-width / 2, baseline, finalAngle, centerX, centerY);
    page.drawText(line, { x: point.x, y: point.y, size: fontSize, font, color: NAVY, rotate: degrees(finalAngle) });
  });
}

function rotateLocalPoint(x: number, y: number, angle: number, centerX: number, centerY: number): Point {
  const radians = angle * Math.PI / 180;
  return {
    x: centerX + Math.cos(radians) * x - Math.sin(radians) * y,
    y: centerY + Math.sin(radians) * x + Math.cos(radians) * y,
  };
}

function fitFont(font: PDFFont, lines: string[], maxWidth: number, maxHeight: number): number {
  for (let size = 6.2; size >= 1.8; size -= 0.1) {
    const widest = Math.max(...lines.map((line) => font.widthOfTextAtSize(line, size)));
    if (widest <= maxWidth && size * 0.92 * lines.length <= maxHeight) return size;
  }
  return 1.8;
}

function compactName(value: string): string[] {
  const name = value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
  if (NAME_OVERRIDES[name]) return NAME_OVERRIDES[name];

  if (name.includes("/")) {
    const parts = name.split("/").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) return parts.slice(0, 2);
  }

  const words = name.split(" ");
  const target = Math.max(1, Math.ceil((name.length - Math.max(words.length - 1, 0)) / 2));
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || (lines.length < 2 && current.length + 1 + word.length > target)) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  while (lines.length > 2) {
    const overflow = lines.pop();
    if (overflow) lines[lines.length - 1] = `${lines.at(-1)} ${overflow}`;
  }

  if (Math.max(...lines.map((line) => line.length), 0) <= 10) return lines;
  if (words.length >= 3) return [words[0], `${words[1]} ${words.slice(2).map((word) => `${word[0]}.`).join("")}`];
  if (words.length === 2) {
    const [first, last] = words;
    return first.length >= last.length ? [`${first.slice(0, 7)}.`, last] : [first, `${last.slice(0, 7)}.`];
  }
  return [`${name.slice(0, 9)}.`];
}

function readableAngle(value: number): number {
  let angle = ((value % 360) + 360) % 360;
  if (angle > 90 && angle <= 270) angle -= 180;
  return angle;
}
