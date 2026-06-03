export function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}

export function ensureErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  return safeStringify(err);
}
