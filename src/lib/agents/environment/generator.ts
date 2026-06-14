import { getScenarioById } from "@/db/queries";
import type { Difficulty } from "@/types";
import type {
  FirewallRule,
  NetworkTopology,
  VirtualFile,
  VirtualHost,
  VirtualService,
  VirtualUser,
  Vulnerability,
} from "@/lib/agents/types";
import { createSeededRandom } from "@/lib/agents/environment/rng";
import {
  CATEGORY_TEMPLATES,
  type HostTemplate,
  serviceKeyToBanner,
  serviceKeyToPort,
} from "@/lib/agents/environment/templates";

const SERVICE_VERSIONS: Record<string, string[]> = {
  ssh: ["8.2p1", "7.4p1", "9.3p2"],
  http: ["2.4.52", "2.4.41", "1.18.0"],
  https: ["1.22.1", "1.18.0", "1.24.0"],
  smb: ["3.1.1", "2.1"],
  rdp: ["10.0"],
  dns: ["9.18", "2.86"],
  mysql: ["8.0.32", "5.7.38", "8.0.36"],
  redis: ["7.0.11", "6.2.14"],
};

function difficultyToHostCount(
  difficulty: string,
  rng: ReturnType<typeof createSeededRandom>,
): number {
  const d = difficulty.toLowerCase();
  if (d === "beginner") return rng.nextInt(3, 4);
  if (d === "intermediate") return rng.nextInt(5, 6);
  if (d === "advanced") return rng.nextInt(6, 8);
  if (d === "expert") return rng.nextInt(8, 10);
  return rng.nextInt(4, 6);
}

function pickOs(
  template: HostTemplate,
  rng: ReturnType<typeof createSeededRandom>,
): string {
  const total = template.osWeights.reduce((s, w) => s + w.weight, 0);
  let r = rng.next() * total;
  for (const row of template.osWeights) {
    r -= row.weight;
    if (r <= 0) return row.os;
  }
  return template.osWeights[0]!.os;
}

export function generateVulnerability(
  serviceKey: string,
  difficulty: string,
  rng: ReturnType<typeof createSeededRandom>,
): Vulnerability[] {
  const d = difficulty.toLowerCase();
  const pool: Vulnerability[] = [];

  const push = (v: Vulnerability) => pool.push(v);

  if (serviceKey === "ssh") {
    push({
      cve: "CVE-2018-15473",
      name: "OpenSSH user enumeration",
      severity: "medium",
      exploitable: true,
      description: "Timing side-channel may reveal valid usernames.",
    });
    push({
      cve: "CVE-2023-38408",
      name: "OpenSSH PKCS11 RCE (simulated)",
      severity: "critical",
      exploitable: d !== "beginner",
      description: "PKCS#11 provider path handling weakness (training simulation).",
    });
  }
  if (serviceKey === "http" || serviceKey === "https") {
    push({
      cve: "CVE-2021-41773",
      name: "Path traversal",
      severity: "high",
      exploitable: true,
      description: "Misconfigured alias may allow filesystem access outside webroot.",
    });
  }
  if (serviceKey === "mysql") {
    push({
      cve: "CVE-2012-2122",
      name: "MySQL authentication bypass (simulated)",
      severity: "critical",
      exploitable: d === "expert" || d === "advanced",
      description: "Edge-case hash comparison flaw on specific builds.",
    });
  }
  if (serviceKey === "redis") {
    push({
      name: "Unauthenticated Redis",
      severity: "critical",
      exploitable: true,
      description: "Redis bound to 0.0.0.0 without AUTH in lab configuration.",
    });
  }
  if (serviceKey === "smb") {
    push({
      cve: "CVE-2020-0796",
      name: "SMBGhost (simulated)",
      severity: "critical",
      exploitable: d !== "beginner",
      description: "SMBv3 compression buffer mishandling.",
    });
  }

  if (pool.length === 0) {
    return [
      {
        name: `${serviceKey} hardening gap`,
        severity: "low",
        exploitable: false,
        description: "Generic configuration weakness for training triage.",
      },
    ];
  }

  const maxVulns =
    d === "beginner"
      ? rng.nextInt(1, 2)
      : d === "intermediate"
        ? rng.nextInt(1, 3)
        : rng.nextInt(2, 4);

  return rng.shuffle(pool).slice(0, Math.min(maxVulns, pool.length));
}

export function generateHost(
  template: HostTemplate,
  index: number,
  rng: ReturnType<typeof createSeededRandom>,
  difficulty: string,
  ip: string,
): VirtualHost {
  const id = `host-${template.role}-${index}-${rng.nextInt(10000, 99999)}`;
  const hostname = `${template.role.replace(/_/g, "-")}-${index}.${template.subnetIndex === 0 ? "corp" : "dmz"}.lab`;
  const os = pickOs(template, rng);

  const services: VirtualService[] = template.serviceKeys
    .map((key) => {
      const port = serviceKeyToPort(key);
      if (port === 0) return null;
      const versions = SERVICE_VERSIONS[key] ?? ["1.0.0"];
      const version = rng.pick(versions);
      return {
        name: key.toUpperCase(),
        port,
        version,
        banner: serviceKeyToBanner(key, version),
        vulnerabilities: generateVulnerability(key, difficulty, rng),
      };
    })
    .filter((s): s is VirtualService => s !== null);

  const users: VirtualUser[] = [
    {
      username: "admin",
      groups: ["sudo", "adm"],
      privileges: "admin",
      hasWeakPassword: rng.next() < (difficulty === "beginner" ? 0.85 : 0.35),
    },
    {
      username: "svc_deploy",
      groups: ["docker"],
      privileges: "user",
      hasWeakPassword: rng.next() < 0.25,
    },
  ];

  const files: VirtualFile[] = [
    {
      path: "/etc/passwd",
      name: "passwd",
      size: 2048,
      permissions: "-rw-r--r--",
      suspicious: false,
      content: `root:x:0:0:root:/root:/bin/bash\nadmin:x:1000:1000:Admin:/home/admin:/bin/bash\nsvc_deploy:x:1001:1001::/home/svc_deploy:/bin/bash\n`,
    },
    {
      path: "/etc/shadow",
      name: "shadow",
      size: 512,
      permissions: "-rw-------",
      suspicious: true,
      content: "root:$6$rounds=5000$salt$hash:19000:0:99999:7:::\n",
    },
  ];

  if (template.extraFileHints) {
    for (const rel of template.extraFileHints) {
      const path = rel.replace(/\\/g, "/");
      const name = path.split("/").pop() ?? "file";
      files.push({
        path,
        name,
        size: rng.nextInt(400, 120000),
        permissions: "-rw-r--r--",
        suspicious:
          name.endsWith(".log") || name.endsWith(".jsonl") || name.endsWith(".dmp") || name.endsWith(".bin"),
        content:
          name.endsWith(".log") || name.endsWith(".jsonl")
            ? `${rng.nextInt(1, 255)}.${rng.nextInt(1, 255)}.${rng.nextInt(1, 255)}.${rng.nextInt(1, 255)} - - [12/Mar/2024:10:15:11 +0000] "GET /admin HTTP/1.1" 403\n`
            : "BINARY_SIMULATION_CHUNK",
      });
    }
  }

  return {
    id,
    hostname,
    ip,
    os,
    services,
    users,
    files,
    isCompromised: false,
  };
}

function buildFirewallRules(
  subnets: [string, string],
  rng: ReturnType<typeof createSeededRandom>,
): FirewallRule[] {
  const base = subnets[0]!.replace("/24", ".0/24");
  const rules: FirewallRule[] = [
    {
      source: "0.0.0.0/0",
      destination: base.replace(".0/24", ".10"),
      port: 443,
      action: "allow",
    },
    {
      source: base,
      destination: subnets[1]!.replace("/24", ".0/24"),
      port: 22,
      action: "allow",
    },
    { source: "0.0.0.0/0", destination: base, port: 445, action: "deny" },
  ];
  return rng.shuffle(rules);
}

function hostOctetRange(cidr: string): { min: number; max: number } {
  const m = cidr.match(/\/(\d+)$/);
  const bits = m ? Number(m[1]) : 24;
  if (bits >= 28) return { min: 4, max: 14 };
  if (bits >= 26) return { min: 8, max: 62 };
  return { min: 10, max: 220 };
}

function assignIps(
  count: number,
  subnets: [string, string],
  rng: ReturnType<typeof createSeededRandom>,
): { ip: string; subnetIdx: 0 | 1 }[] {
  const out: { ip: string; subnetIdx: 0 | 1 }[] = [];
  for (let i = 0; i < count; i += 1) {
    const subnetIdx = (i % 2 === 0 ? 0 : 1) as 0 | 1;
    const cidr = subnets[subnetIdx]!;
    const base = cidr.split("/")[0]!;
    const parts = base.split(".").map(Number);
    const { min, max } = hostOctetRange(cidr);
    parts[3] = rng.nextInt(min, max);
    out.push({ ip: parts.join("."), subnetIdx });
  }
  return out;
}

export async function generateEnvironment(
  scenarioId: number,
  difficulty: string,
  sessionSeed?: number,
): Promise<NetworkTopology> {
  const scenario = await getScenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`);
  }

  const rng = createSeededRandom(sessionSeed ?? scenarioId * 7919 + scenarioId);
  const template = CATEGORY_TEMPLATES[scenario.category];
  const hostCount = Math.min(
    difficultyToHostCount(difficulty || scenario.difficulty, rng),
    Math.max(3, template.hostTemplates.length * 2),
  );

  const shuffledTemplates = rng.shuffle([...template.hostTemplates]);
  const selected: HostTemplate[] = [];
  for (let i = 0; i < hostCount; i += 1) {
    selected.push(shuffledTemplates[i % shuffledTemplates.length]!);
  }

  const ips = assignIps(selected.length, template.subnets, rng);
  const hosts: VirtualHost[] = selected.map((ht, idx) =>
    generateHost(ht, idx, rng, difficulty || scenario.difficulty, ips[idx]!.ip),
  );

  const diff = (difficulty || scenario.difficulty) as Difficulty;
  if (diff === "advanced" || diff === "expert") {
    const decoy = rng.pick(hosts);
    decoy.files.push({
      path: "/opt/decoy/readme.txt",
      name: "readme.txt",
      size: 80,
      permissions: "-rw-r--r--",
      suspicious: false,
      content: "This is a red herring artifact. Ignore unless required by scenario rubric.\n",
    });
  }

  return {
    hosts,
    firewallRules: buildFirewallRules(template.subnets, rng),
    subnet: template.subnets.join(" · "),
  };
}
