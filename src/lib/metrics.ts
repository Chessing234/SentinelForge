let apiRequestCount = 0;
let totalResponseMs = 0;
let errorCount = 0;

export function recordApiRequest(): void {
  apiRequestCount += 1;
}

export function recordApiResponseTime(ms: number, isError = false): void {
  totalResponseMs += ms;
  if (isError) errorCount += 1;
}

export function getApiRequestCount(): number {
  return apiRequestCount;
}

export function getAvgResponseMs(): number {
  if (apiRequestCount === 0) return 0;
  return Math.round(totalResponseMs / apiRequestCount);
}

export function getErrorRatePercent(): number {
  if (apiRequestCount === 0) return 0;
  return Math.round((errorCount / apiRequestCount) * 1000) / 10;
}
