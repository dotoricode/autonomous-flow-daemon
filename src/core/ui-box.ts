export const BOX = {
  tl: "┌", tr: "┐", bl: "└", br: "┘",
  h: "─", v: "│", ml: "├", mr: "┤",
} as const;

/** Create box-drawing helpers for a given inner width. */
export function createBox(w: number) {
  const hline = (l: string, r: string) => `${l}${BOX.h.repeat(w)}${r}`;
  const row = (s: string) => {
    const pad = Math.max(0, w - 2 - s.length);
    return `${BOX.v} ${s}${" ".repeat(pad)} ${BOX.v}`;
  };
  return {
    hline,
    row,
    top: () => hline(BOX.tl, BOX.tr),
    mid: () => hline(BOX.ml, BOX.mr),
    bot: () => hline(BOX.bl, BOX.br),
  };
}
