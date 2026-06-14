/**
 * Realism helpers: staggered timestamps, benign noise, anti-forensics hints.
 */

export function staggeredAttackTimestamp(
  sessionId: number,
  stepIndex: number,
  totalSteps: number,
): Date {
  const base = Date.now() - (totalSteps - stepIndex) * 3 * 60 * 1000;
  const jitter = ((sessionId * 31 + stepIndex * 17) % 120) * 1000;
  return new Date(base + jitter);
}

export function artifactTimestamp(isBackdated: boolean): string {
  const d = new Date();
  if (isBackdated) {
    d.setHours(d.getHours() - 6);
  }
  return d.toISOString();
}

export function benignProcessNoiseLine(seed: number): string {
  const noise = [
    "root       220  0.0  0.0  10240  2048 ?        Ss   Mar10   0:00 /usr/sbin/cron -f",
    "syslog     310  0.0  0.0  22528  4096 ?        Ssl  Mar10   0:18 /usr/sbin/rsyslogd -n",
    "root       330  0.0  0.0  11264  3584 ?        Ss   Mar10   0:01 /usr/lib/systemd/systemd-journald",
  ];
  return noise[seed % noise.length]!;
}

export function antiForensicNote(difficulty: string): string | null {
  const d = difficulty.toLowerCase();
  if (d === "advanced" || d === "expert") {
    return "# timestomp + partial log wipe simulated on high difficulty";
  }
  return null;
}

export function correlateArtifactNote(stepIndex: number, pid: number): string {
  return `# correlated: step ${stepIndex + 1} spawned pid ${pid} same epoch as staging dir mtime`;
}
