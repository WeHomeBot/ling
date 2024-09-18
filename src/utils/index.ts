
export function shortId() {
  return Math.random().toString(36).slice(2, 12);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}