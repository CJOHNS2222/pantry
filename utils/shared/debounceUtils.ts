export function debounce<T extends (...args: any[]) => any>(fn: T, wait = 200) {
  let t: any;
  return function(this: any, ...args: any[]) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  } as T;
}
