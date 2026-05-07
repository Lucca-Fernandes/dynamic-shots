export function normalizeBrPhone(input: string): string {
  let n = (input || '').replace(/\D/g, '');

  if ((n.length === 12 || n.length === 13) && n.startsWith('55')) {
    n = n.substring(2);
  }

  if (n.length === 10 && /[6-9]/.test(n[2])) {
    n = n.substring(0, 2) + '9' + n.substring(2);
  }

  return '55' + n;
}
