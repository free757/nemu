import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SegmentItem } from "../types/atlas";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Smart time range parser using regex pattern matching.
 * Handles any unicode dash (–, —, -, ~) and formats like:
 * "0:00.00–0:03.00", "0:00.00 - 0:03.00", "0:07.33–0:13.32"
 */
export function parseTimeRange(rangeStr: string): { startTime: string; endTime: string } | null {
  if (!rangeStr) return null;
  const matches = rangeStr.match(/\d{1,2}:\d{2}(?:\.\d{1,3})?/g);
  if (matches && matches.length >= 2) {
    return {
      startTime: matches[0],
      endTime: matches[1],
    };
  }
  return null;
}

/**
 * Smart Bulk Parser for text containing multiple timestamps and labels.
 * Supports both line-by-line format and single-line timestamp + label format.
 */
export function parseBulkSegmentsText(bulkText: string): SegmentItem[] {
  if (!bulkText) return [];
  const lines = bulkText.split("\n").map((line) => line.trim()).filter(Boolean);
  const segments: SegmentItem[] = [];

  const isTimestamp = (str: string) => /^\d{1,2}:\d{2}(?:\.\d{1,3})?$/.test(str);
  
  const isMetadata = (str: string) => {
    return (
      /^\(\d+(\.\d+)?s\)$/.test(str) ||
      /^\d+w$/.test(str) ||
      /^[⚠⚠️]\s*\d+%?$/.test(str) ||
      /^\d+%$/.test(str) ||
      str === "→" || str === "->" || str === "–" || str === "—"
    );
  };

  // 1. Check if we have single-line range format somewhere first
  let hasSingleLineTimeRange = false;
  for (const line of lines) {
    const timeMatch = parseTimeRange(line);
    if (timeMatch) {
      const lineWithoutTimes = line
        .replace(/\d{1,2}:\d{2}(?:\.\d{1,3})?/g, "")
        .replace(/[\s–—\-~→>]+/g, " ")
        .trim();
      if (lineWithoutTimes.length > 2) {
        hasSingleLineTimeRange = true;
        break;
      }
    }
  }

  if (hasSingleLineTimeRange) {
    let pendingTime: { startTime: string; endTime: string } | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(AI|Play segment \d+|Segment \d+|Step \d+|Label rubric|Correct the AI labels|Practice assessment|Assessment|PROGRESS|How it works|Learn to label|How to label|The exact format|Start paid work|Payments processed|Scene:.*|Try another clip|Submit practice clip|Exit|•)$/i.test(line)) {
        continue;
      }
      const timeMatch = parseTimeRange(line);
      if (timeMatch) {
        const lineWithoutTimes = line
          .replace(/\d{1,2}:\d{2}(?:\.\d{1,3})?/g, "")
          .replace(/[\s–—\-~→>]+/g, " ")
          .trim();
        if (lineWithoutTimes.length > 2) {
          segments.push({
            id: `seg-${Date.now()}-${segments.length + 1}`,
            startTime: timeMatch.startTime,
            endTime: timeMatch.endTime,
            currentLabel: lineWithoutTimes,
            status: "idle",
          });
          pendingTime = null;
        } else {
          pendingTime = timeMatch;
        }
      } else if (pendingTime) {
        segments.push({
          id: `seg-${Date.now()}-${segments.length + 1}`,
          startTime: pendingTime.startTime,
          endTime: pendingTime.endTime,
          currentLabel: line,
          status: "idle",
        });
        pendingTime = null;
      }
    }
    return segments;
  }

  // 2. Parse multi-line copy-paste format from the paid work page
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    if (isTimestamp(currentLine)) {
      let nextTimeIndex = -1;
      if (i + 1 < lines.length && isTimestamp(lines[i + 1])) {
        nextTimeIndex = i + 1;
      } else if (i + 2 < lines.length && (lines[i + 1] === "→" || lines[i + 1] === "->") && isTimestamp(lines[i + 2])) {
        nextTimeIndex = i + 2;
      }

      if (nextTimeIndex !== -1) {
        const startTime = currentLine;
        const endTime = lines[nextTimeIndex];
        let labelLine = "";
        let scanIdx = nextTimeIndex + 1;

        while (scanIdx < lines.length) {
          const checkLine = lines[scanIdx];
          if (isTimestamp(checkLine) || /^\d+$/.test(checkLine)) {
            break;
          }
          if (!isMetadata(checkLine) && checkLine.length > 1) {
            labelLine = checkLine;
            break;
          }
          scanIdx++;
        }

        if (labelLine) {
          segments.push({
            id: `seg-${Date.now()}-${segments.length + 1}`,
            startTime,
            endTime,
            currentLabel: labelLine,
            status: "idle",
          });
        }
        i = nextTimeIndex;
      }
    }
  }

  return segments;
}

/**
 * Instant Arabic Translation Helper for Atlas Action Labels & Visual Evidence
 */
export function translateToArabic(englishText: string): string {
  if (!englishText) return "";

  // Full sentence phrases mapping
  if (englishText.includes("Applied ground-truth Atlas rubric syntax rules")) {
    return "تم تطبيق القواعد النحوية والقياسية المعتمدة لأطلس.";
  }

  let ar = englishText;

  // Dictionary mappings
  const dict: [RegExp, string][] = [
    [/ground truth matched for scenario:\s*/gi, "تمت مطابقة الإجابة الرسمية للسيناريو: "],
    [/ground truth matched\s*/gi, "تمت مطابقة الإجابة الرسمية "],
    [/ground truth\s*/gi, "الإجابة الرسمية"],
    [/practice clip\s*/gi, "كليب التدريب "],
    [/Action syntax verified:\s*/gi, "تم فحص وتأكيد حركة اليدين: "],
    [/Observed action:\s*/gi, "ملاحظة حركة اليدين في المشهد: "],
    [/Action verified:\s*/gi, "تم تأكيد الحركة في المشهد: "],

    // Actions
    [/\bpick up\b/gi, "التقاط/رفع"],
    [/\bplace\b/gi, "وضع"],
    [/\bset\b/gi, "وضع"],
    [/\bhold\b/gi, "إمساك/تثبيت"],
    [/\bpass\b/gi, "تمرير/نقل"],
    [/\bwipe\b/gi, "مسح/تنظيف"],
    [/\brotate\b/gi, "تدوير/لف"],
    [/\bsmoothen\b/gi, "تنعيم/فرد القماش"],
    [/\bsmooth\b/gi, "تنعيم/فرد"],
    [/\bflatten\b/gi, "فرد/تسطيح"],
    [/\blook at\b/gi, "معاينة بالنظر"],
    [/\btouch\b/gi, "لمس"],
    [/\binsert\b/gi, "إدخال"],
    [/\bpull\b/gi, "سحب"],
    [/\bdig\b/gi, "حفر/تجريف"],
    [/\bgather\b/gi, "تجميع"],
    [/\bwater\b/gi, "ري/سقي"],
    [/\bfill\b/gi, "ملء"],
    [/\bstir\b/gi, "تقليب"],
    [/\brake\b/gi, "تجريف/كنس"],
    [/\balign\b/gi, "محاذاة"],
    [/\bcut\b/gi, "قص/قطع"],
    [/\bstrip\b/gi, "تقشير/تعرية"],
    [/\bslide\b/gi, "تحريك على سطح"],
    [/\btighten\b/gi, "إحكام ربط/شد"],
    [/\bfold\b/gi, "طيّ"],
    [/\btuck\b/gi, "دس/إدخال طرف"],
    [/\bsqueeze\b/gi, "عصر/ضغط"],
    [/\bposition\b/gi, "تثبيت دقيق"],

    // Objects
    [/\bbook\b/gi, "كتاب"],
    [/\bpage\b/gi, "صفحة"],
    [/\bsewing needle\b/gi, "إبرة الخياطة"],
    [/\bneedle\b/gi, "إبرة"],
    [/\bthread\b/gi, "خيط"],
    [/\bcap\b/gi, "غطاء/قبعة"],
    [/\bpatch\b/gi, "رقعة"],
    [/\bglass cup\b/gi, "كأس زجاجي"],
    [/\bglass jar\b/gi, "برطمان زجاجي"],
    [/\bcup\b/gi, "كأس"],
    [/\bjar\b/gi, "برطمان"],
    [/\bcloth\b/gi, "قطعة قماش"],
    [/\bpaper\b/gi, "ورقة"],
    [/\bpapers\b/gi, "أوراق"],
    [/\bscissors\b/gi, "مقص"],
    [/\bhoe\b/gi, "فأس/مجرفة زراعية"],
    [/\bhose\b/gi, "خرطوم المياه"],
    [/\bwatering can\b/gi, "إبريق الري"],
    [/\bbucket\b/gi, "دلو"],
    [/\bsoil\b/gi, "التربة"],
    [/\bleaves\b/gi, "أوراق الشجر"],
    [/\bplant\b/gi, "نبتة"],
    [/\bminced meat\b/gi, "لحم مفروم"],
    [/\bmeat\b/gi, "لحم"],
    [/\bonions\b/gi, "بصل"],
    [/\bwok\b/gi, "مقلاة/وعاء الطهي"],
    [/\bladle\b/gi, "مغرفة الطهي"],
    [/\bscrewdriver\b/gi, "مفك براغي"],
    [/\belectrical plug\b/gi, "فيشة كهربائية"],
    [/\bplug\b/gi, "فيشة"],
    [/\bscrews\b/gi, "براغي"],
    [/\bscrew\b/gi, "برغي"],
    [/\btray\b/gi, "صينية"],
    [/\bbottle\b/gi, "زجاجة"],
    [/\bsyrup bottle\b/gi, "زجاجة شربات"],
    [/\bbag\b/gi, "كيس"],
    [/\bsachet\b/gi, "كيس صغير"],
    [/\bsnack bag\b/gi, "كيس وجبة تسالي"],
    [/\bcounter\b/gi, "رخامة/منضدة العمل"],
    [/\btable\b/gi, "طاولة"],
    [/\bground\b/gi, "الأرض"],
    [/\bfloor\b/gi, "الأرضية"],

    // Prepositions & Hands
    [/\bwith right hand\b/gi, "باليد اليمنى"],
    [/\bwith left hand\b/gi, "باليد اليسرى"],
    [/\bwith both hands\b/gi, "بكلتا اليدين"],
    [/\bin right hand\b/gi, "في اليد اليمنى"],
    [/\bin left hand\b/gi, "في اليد اليسرى"],
    [/\bin both hands\b/gi, "في كلتا اليدين"],
    [/\bfrom right hand to left hand\b/gi, "من اليد اليمنى إلى اليد اليسرى"],
    [/\bfrom left hand to right hand\b/gi, "من اليد اليسرى إلى اليد اليمنى"],
    [/\bin\b/gi, "في"],
    [/\bon\b/gi, "على"],
    [/\binto\b/gi, "في"],
    [/\bwith\b/gi, "بـ"],
    [/\bfrom\b/gi, "من"],
    [/\bto\b/gi, "إلى"],
    [/\band\b/gi, "و"],
  ];

  for (const [regex, replacement] of dict) {
    ar = ar.replace(regex, replacement);
  }

  return ar;
}

/**
 * Sanitizes and cleans up Atlas labels to strictly follow rubric rules
 * and auto-correct common banned words.
 */
export function sanitizeAtlasLabel(label: string): string {
  if (!label) return "";
  let text = label
    .replace(/\b(the|a|an)\b/gi, "")
    .replace(/\bgrab\b/gi, "pick up")
    .replace(/\bgrabs\b/gi, "picks up")
    .replace(/\bgrabbing\b/gi, "picking up")
    .replace(/\breach for\b/gi, "pick up")
    .replace(/\breaches for\b/gi, "picks up")
    .replace(/\breach\b/gi, "pick up")
    .replace(/\breaches\b/gi, "picks up")
    .replace(/\binspect\b/gi, "look at")
    .replace(/\binspects\b/gi, "looks at")
    .replace(/\binspecting\b/gi, "looking at")
    .replace(/\bmanipulate\b/gi, "slide")
    .replace(/\bmanipulates\b/gi, "slides")
    .replace(/\bmanipulating\b/gi, "sliding")
    .replace(/\breposition\b/gi, "place")
    .replace(/\brepositions\b/gi, "places")
    .replace(/\bsmooth\b/gi, "smoothen")
    .replace(/\bput\b/gi, "place")
    .replace(/\bset\b/gi, "place")
    .replace(/\bturn\b/gi, "rotate")
    .replace(/\bspin\b/gi, "rotate")
    .replace(/\bcollect\b/gi, "gather")
    .replace(/\bgrip\b/gi, "hold")
    .replace(/\bclutch\b/gi, "hold")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}
