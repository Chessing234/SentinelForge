let apiRequestCount = 0;

export function recordApiRequest(): void {
  apiRequestCount += 1;
}

export function getApiRequestCount(): number {
  return apiRequestCount;
}
