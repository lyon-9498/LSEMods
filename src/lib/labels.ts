export function unitLabel(units: number | null | undefined): string {
  if (units === null || units === undefined) return "? units";
  if (units === 0) return "no credit";
  if (units === 0.5) return "0.5 unit";
  if (units === 1) return "1 unit";
  return `${units} units`;
}

export function termLabel(t: string): string {
  if (t === "AT") return "Autumn";
  if (t === "WT") return "Winter";
  if (t === "ST") return "Spring";
  if (t === "SM") return "Summer";
  return t;
}

/** CSS class for coloured term chips (Claude mock: Autumn orange, Winter blue). */
export function termChipClass(t: string): string {
  if (t === "AT") return "chip-term-at";
  if (t === "WT") return "chip-term-wt";
  if (t === "ST") return "chip-term-st";
  if (t === "SM") return "chip-term-sm";
  return "chip-unit";
}

/** Assessment bar segment colour by type keyword. */
export function assessmentColorClass(type: string): string {
  const t = type.toLowerCase();
  if (/exam|summative examination/.test(t)) return "bg-assess-exam";
  if (/participat|presentat|oral|class/.test(t)) return "bg-assess-participation";
  if (/coursework|essay|project|dissertation|poster|assignment|portfolio|blog/.test(t)) {
    return "bg-assess-coursework";
  }
  return "bg-assess-coursework";
}

export function colorForCode(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 45% 42%)`;
}
