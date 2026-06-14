import type { Category } from "@/types";

export type HostRole =
  | "router"
  | "ad_server"
  | "linux_web"
  | "workstation"
  | "db_server"
  | "app_server"
  | "s3_gateway"
  | "ec2_worker"
  | "iam_bastion"
  | "ir_workstation"
  | "sandbox"
  | "forensics_lab";

export interface HostTemplate {
  role: HostRole;
  /** Weighted OS choices */
  osWeights: { os: string; weight: number }[];
  /** Logical service keys — mapped to ports in generator */
  serviceKeys: string[];
  subnetIndex: 0 | 1;
  /** Optional extra file paths relative to host */
  extraFileHints?: string[];
}

export interface CategoryInfrastructureTemplate {
  category: Category;
  /** CIDR summaries for trainee-facing topology */
  subnets: [string, string];
  hostTemplates: HostTemplate[];
  /** Default firewall posture */
  defaultOpenPorts: number[];
}

const COMMON_SVC = ["ssh", "http", "https", "smb", "rdp", "dns"] as const;

const WEB_DMZ = ["http", "https", "mysql", "redis"] as const;

export const NETWORK_SECURITY_TEMPLATE: CategoryInfrastructureTemplate = {
  category: "network_security",
  subnets: ["192.168.1.0/24", "192.168.2.0/24"],
  hostTemplates: [
    {
      role: "router",
      osWeights: [{ os: "VyOS 1.4", weight: 1 }],
      serviceKeys: ["ssh", "dns"],
      subnetIndex: 0,
    },
    {
      role: "ad_server",
      osWeights: [{ os: "Windows Server 2019", weight: 1 }],
      serviceKeys: [...COMMON_SVC],
      subnetIndex: 0,
    },
    {
      role: "linux_web",
      osWeights: [{ os: "Ubuntu 22.04 LTS", weight: 1 }],
      serviceKeys: ["ssh", "http", "https"],
      subnetIndex: 0,
    },
    {
      role: "workstation",
      osWeights: [
        { os: "Windows 11 Enterprise", weight: 0.6 },
        { os: "Windows 10 Pro", weight: 0.4 },
      ],
      serviceKeys: ["rdp", "smb"],
      subnetIndex: 1,
    },
    {
      role: "linux_web",
      osWeights: [{ os: "Debian 11", weight: 1 }],
      serviceKeys: ["ssh", "http", "mysql"],
      subnetIndex: 1,
      extraFileHints: ["/var/www/html/config.php"],
    },
  ],
  defaultOpenPorts: [22, 53, 80, 443, 445, 3389],
};

export const WEB_SECURITY_TEMPLATE: CategoryInfrastructureTemplate = {
  category: "web_security",
  subnets: ["10.0.1.0/24", "10.0.2.0/24"],
  hostTemplates: [
    {
      role: "router",
      osWeights: [{ os: "pfSense 2.7", weight: 1 }],
      serviceKeys: ["dns", "https"],
      subnetIndex: 0,
    },
    {
      role: "linux_web",
      osWeights: [{ os: "Ubuntu 20.04 LTS", weight: 1 }],
      serviceKeys: [...WEB_DMZ],
      subnetIndex: 0,
      extraFileHints: ["/var/www/html/index.php", "/var/www/html/.env"],
    },
    {
      role: "app_server",
      osWeights: [{ os: "Ubuntu 22.04 LTS", weight: 1 }],
      serviceKeys: ["ssh", "http", "redis"],
      subnetIndex: 0,
    },
    {
      role: "db_server",
      osWeights: [{ os: "Debian 12", weight: 1 }],
      serviceKeys: ["ssh", "mysql"],
      subnetIndex: 1,
    },
  ],
  defaultOpenPorts: [22, 80, 443, 3306, 6379],
};

export const CLOUD_SECURITY_TEMPLATE: CategoryInfrastructureTemplate = {
  category: "cloud_security",
  subnets: ["172.16.0.0/24", "172.16.1.0/24"],
  hostTemplates: [
    {
      role: "iam_bastion",
      osWeights: [{ os: "Amazon Linux 2023", weight: 1 }],
      serviceKeys: ["ssh", "https"],
      subnetIndex: 0,
      extraFileHints: ["/home/ec2-user/iam-policy.json", "/var/log/cloudtrail_sim.jsonl"],
    },
    {
      role: "s3_gateway",
      osWeights: [{ os: "Amazon Linux 2", weight: 1 }],
      serviceKeys: ["https"],
      subnetIndex: 0,
    },
    {
      role: "ec2_worker",
      osWeights: [{ os: "Amazon Linux 2023", weight: 1 }],
      serviceKeys: ["ssh", "http"],
      subnetIndex: 1,
    },
    {
      role: "linux_web",
      osWeights: [{ os: "Ubuntu 22.04 LTS", weight: 1 }],
      serviceKeys: ["http", "https"],
      subnetIndex: 1,
    },
  ],
  defaultOpenPorts: [22, 80, 443],
};

export const INCIDENT_RESPONSE_TEMPLATE: CategoryInfrastructureTemplate = {
  category: "incident_response",
  subnets: ["192.168.50.0/24", "192.168.51.0/24"],
  hostTemplates: [
    {
      role: "ir_workstation",
      osWeights: [{ os: "Windows 11 IR Lab", weight: 1 }],
      serviceKeys: ["rdp", "smb"],
      subnetIndex: 0,
      extraFileHints: [
        "/ir/memory_dump.dmp",
        "/ir/timeline.csv",
        "/ir/suspicious_ps.txt",
      ],
    },
    {
      role: "ad_server",
      osWeights: [{ os: "Windows Server 2022", weight: 1 }],
      serviceKeys: ["rdp", "smb", "dns"],
      subnetIndex: 0,
    },
    {
      role: "linux_web",
      osWeights: [{ os: "CentOS 7 (EOL)", weight: 1 }],
      serviceKeys: ["ssh", "http"],
      subnetIndex: 1,
    },
  ],
  defaultOpenPorts: [22, 80, 135, 445, 3389],
};

export const MALWARE_ANALYSIS_TEMPLATE: CategoryInfrastructureTemplate = {
  category: "malware_analysis",
  subnets: ["10.20.0.0/28", "10.20.0.0/28"],
  hostTemplates: [
    {
      role: "sandbox",
      osWeights: [{ os: "Windows 10 Sandbox", weight: 0.5 }, { os: "Ubuntu 22.04 Sandbox", weight: 0.5 }],
      serviceKeys: ["ssh"],
      subnetIndex: 0,
      extraFileHints: [
        "/malware/sample.bin",
        "/malware/registry_diff.reg",
        "/malware/callbacks.log",
      ],
    },
  ],
  defaultOpenPorts: [22],
};

export const FORENSICS_TEMPLATE: CategoryInfrastructureTemplate = {
  category: "forensics",
  subnets: ["10.30.0.0/24", "10.30.0.0/24"],
  hostTemplates: [
    {
      role: "forensics_lab",
      osWeights: [{ os: "SIFT Workstation (Ubuntu)", weight: 1 }],
      serviceKeys: ["ssh", "http"],
      subnetIndex: 0,
      extraFileHints: [
        "/cases/corp-2024/disk.E01",
        "/cases/corp-2024/deleted_recovered/notes.txt",
        "/cases/corp-2024/logs/auth.log",
        "/cases/corp-2024/logs/access.log",
      ],
    },
    {
      role: "linux_web",
      osWeights: [{ os: "Debian 11", weight: 1 }],
      serviceKeys: ["ssh", "http"],
      subnetIndex: 0,
    },
  ],
  defaultOpenPorts: [22, 80],
};

export const CATEGORY_TEMPLATES: Record<Category, CategoryInfrastructureTemplate> = {
  network_security: NETWORK_SECURITY_TEMPLATE,
  web_security: WEB_SECURITY_TEMPLATE,
  cloud_security: CLOUD_SECURITY_TEMPLATE,
  incident_response: INCIDENT_RESPONSE_TEMPLATE,
  malware_analysis: MALWARE_ANALYSIS_TEMPLATE,
  forensics: FORENSICS_TEMPLATE,
};

export function serviceKeyToPort(key: string): number {
  const map: Record<string, number> = {
    ssh: 22,
    http: 80,
    https: 443,
    smb: 445,
    rdp: 3389,
    dns: 53,
    mysql: 3306,
    redis: 6379,
  };
  return map[key] ?? 0;
}

export function serviceKeyToBanner(key: string, version: string): string {
  const banners: Record<string, string> = {
    ssh: `SSH-2.0-OpenSSH_${version}`,
    http: `Apache httpd ${version}`,
    https: `nginx/${version}`,
    smb: `Microsoft SMB 2.1`,
    rdp: `Microsoft Terminal Services`,
    dns: `dnsmasq ${version}`,
    mysql: `MySQL ${version}`,
    redis: `Redis ${version}`,
  };
  return banners[key] ?? `${key}/${version}`;
}
