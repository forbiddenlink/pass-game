/**
 * End a sentence with exactly one terminal mark. Model output often already ends
 * in punctuation, so blindly appending "." produced "dream..". An ellipsis the
 * writer meant ("...", "…") is kept; a stray double period collapses to one.
 */
export function endSentence(text: string): string {
  const s = text.trim().replace(/\s+/g, ' ');
  if (!s) return s;
  if (/(\.{3,}|…)["'”’)]*$/.test(s)) return s;
  const collapsed = s.replace(/\.\.(?=["'”’)]*$)/, '.');
  if (/[.!?]["'”’)]*$/.test(collapsed)) return collapsed;
  return `${collapsed}.`;
}
