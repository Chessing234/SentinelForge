import type { CommandResult, NetworkTopology, VirtualHost } from "@/lib/agents/types";
import type { StoredEnvironmentPayload } from "@/lib/agents/environment/session-store";

import type { ParsedCommand } from "@/lib/agents/environment/command-parser";

function ok(stdout: string, stderr = ""): CommandResult {
  return { exitCode: 0, stdout, stderr };
}

function err(msg: string): CommandResult {
  return { exitCode: 1, stdout: "", stderr: msg };
}

function findHostByIp(topology: NetworkTopology, ip: string): VirtualHost | undefined {
  const target = ip.trim();
  return topology.hosts.find(
    (h) => h.ip === target || h.hostname === target || h.hostname.startsWith(target),
  );
}

function findHostContainingFile(topology: NetworkTopology, path: string): VirtualHost | undefined {
  const normalized = path.replace(/\\/g, "/");
  return topology.hosts.find((h) => h.files.some((f) => f.path === normalized));
}

function nmapScan(topology: NetworkTopology, target: string): CommandResult {
  const t = target.toLowerCase();
  if (!t.includes("192.168") && !t.includes("10.") && !t.includes("172.16")) {
    return ok(`Note: Scanning ${target} (simulated)\nNo hosts found in lab scope.\n`);
  }
  const lines = ["Starting Nmap 7.94 ( https://nmap.org )", `Nmap scan report for ${target}`];
  for (const h of topology.hosts) {
    lines.push(`Nmap scan report for ${h.hostname} (${h.ip})`);
    lines.push(`Host is up (0.00042s latency).`);
    lines.push("PORT     STATE SERVICE");
    for (const s of h.services) {
      lines.push(`${String(s.port).padEnd(5)}/tcp  open  ${s.name.toLowerCase()}`);
    }
    lines.push(`Aggressive OS guesses: ${h.os}`);
    lines.push("");
  }
  lines.push(`Nmap done: ${topology.hosts.length} IP addresses (${topology.hosts.length} hosts up) scanned in 1.21 seconds`);
  return ok(lines.join("\n"));
}

function catFile(topology: NetworkTopology, path: string): CommandResult {
  const host = findHostContainingFile(topology, path);
  if (!host) {
    return err(`cat: ${path}: No such file or directory`);
  }
  const file = host.files.find((f) => f.path === path.replace(/\\/g, "/"));
  if (!file?.content) {
    return err(`cat: ${path}: Permission denied`);
  }
  return ok(file.content);
}

function grepInFiles(topology: NetworkTopology, pattern: string, pathHint?: string): CommandResult {
  const hits: string[] = [];
  for (const h of topology.hosts) {
    for (const f of h.files) {
      if (pathHint && !f.path.includes(pathHint)) continue;
      const c = f.content ?? "";
      if (c.includes(pattern) || c.toLowerCase().includes(pattern.toLowerCase())) {
        hits.push(`${h.ip}:${f.path}:${c.split("\n").find((l) => l.includes(pattern)) ?? "<match>"}`);
      }
    }
  }
  if (hits.length === 0) {
    return ok("");
  }
  return ok(hits.join("\n"));
}

function findFiles(topology: NetworkTopology, namePattern: string): CommandResult {
  const hits: string[] = [];
  for (const h of topology.hosts) {
    for (const f of h.files) {
      if (f.name.includes(namePattern) || f.path.includes(namePattern)) {
        hits.push(`${h.ip}:${f.path}`);
      }
    }
  }
  return ok(hits.join("\n") || "find: no matches");
}

function curlUrl(topology: NetworkTopology, url: string): CommandResult {
  const m = url.match(/https?:\/\/([^/:]+)/i);
  const hostPart = m?.[1];
  if (!hostPart) {
    return err("curl: invalid URL");
  }
  const host =
    topology.hosts.find((h) => h.ip === hostPart) ??
    topology.hosts.find((h) => h.hostname.includes(hostPart));
  if (!host) {
    return ok(`curl: (6) Could not resolve host: ${hostPart}\n`);
  }
  const svc = host.services.find((s) => s.port === 443 || s.port === 80);
  return ok(
    [
      `HTTP/1.1 200 OK`,
      `Server: ${svc?.banner ?? "nginx"}`,
      `Content-Type: text/html`,
      ``,
      `<html><title>${host.hostname}</title><body><!-- lab banner -->ok</body></html>`,
    ].join("\n"),
  );
}

function sshAttempt(
  topology: NetworkTopology,
  user: string,
  target: string,
  password?: string,
): CommandResult {
  const hostPart = target.includes("@") ? target.split("@")[1]! : target;
  const u = target.includes("@") ? target.split("@")[0]! : user;
  const host = findHostByIp(topology, hostPart);
  if (!host) {
    return err(`ssh: Could not resolve hostname ${hostPart}`);
  }
  const account = host.users.find((x) => x.username === u);
  if (!account) {
    return err("Permission denied (publickey,password).");
  }
  const weakOk =
    account.hasWeakPassword &&
    (!password || ["lab123", "password", "admin", "Password123"].includes(password));
  if (weakOk) {
    return ok(`Welcome to Ubuntu ${host.os}\nLast login: Mon Mar 11 09:15:00 2024 from 10.0.0.5\n`);
  }
  if (password === "correct-horse-battery-staple") {
    return ok(`Welcome ${u}@${host.hostname}\n`);
  }
  return err("Permission denied (publickey,password).");
}

function hydraHint(topology: NetworkTopology): CommandResult {
  const weak = topology.hosts.flatMap((h) =>
    h.users.filter((u) => u.hasWeakPassword).map((u) => `${h.ip}\t${u.username}`),
  );
  if (weak.length === 0) {
    return ok("[hydra] no weak-password targets discovered in simulation window.\n");
  }
  return ok(
    `[hydra] simulated attack summary\nHost\tLogin\n${weak.join("\n")}\n[hydra] try password: lab123\n`,
  );
}

function sqlmapSim(): CommandResult {
  return ok(
    [
      "[*] starting @ 09:41:02 /2024-03-11/",
      "[INFO] testing connection to the target URL",
      "[INFO] GET parameter 'id' appears to be 'MySQL > 5.0.12' injectable",
      "Payload: 1' AND UPDATEXML(rand(),CONCAT(0x3a,(SELECT @@version)),null)-- -",
      "[INFO] retrieved: '8.0.32-0ubuntu0.22.04.2'",
    ].join("\n") + "\n",
  );
}

function base64op(mode: "decode" | "encode", data: string): CommandResult {
  if (mode === "decode") {
    try {
      const buf = Buffer.from(data, "base64");
      return ok(buf.toString("utf8"));
    } catch {
      return err("base64: invalid input");
    }
  }
  return ok(Buffer.from(data, "utf8").toString("base64") + "\n");
}

function stringsSim(path: string, topology: NetworkTopology): CommandResult {
  const host = findHostContainingFile(topology, path);
  if (!host) return err("strings: file not found");
  const file = host.files.find((f) => f.path === path);
  if (!file?.content) return ok("BINARY\n");
  const ascii = file.content.match(/[ -~]{4,}/g) ?? [];
  return ok(ascii.join("\n") + "\n");
}

export function executeParsedCommand(
  payload: StoredEnvironmentPayload,
  parsed: ParsedCommand,
): CommandResult {
  const topology = payload.topology;
  if (parsed.kind === "empty") {
    return err("");
  }
  if (parsed.kind === "flag") {
    return err("Use the dedicated flag handler (internal).");
  }

  const { program, args } = parsed;

  switch (program) {
    case "nmap": {
      const target = args[0] ?? "127.0.0.1";
      return nmapScan(topology, target);
    }
    case "nslookup":
    case "dig": {
      const host = args[0] ?? "corp.lab";
      return ok(`Server:\t127.0.0.53\nAddress:\t127.0.0.53#53\n\nName:\t${host}\nAddress: ${topology.hosts[0]?.ip ?? "10.0.0.10"}\n`);
    }
    case "curl":
    case "wget": {
      const url = args[0] ?? "http://127.0.0.1/";
      return curlUrl(topology, url);
    }
    case "ssh": {
      const target = args[0] ?? "";
      let password: string | undefined;
      const pIdx = args.indexOf("-p");
      if (pIdx !== -1 && args[pIdx + 1]) {
        password = args[pIdx + 1];
      } else if (args[1] && !args[1].startsWith("-")) {
        password = args[args.length - 1];
      }
      const userHost = target.includes("@") ? target.split("@") : ["admin", target];
      const user = userHost[0] ?? "admin";
      const host = userHost[1] ?? "";
      return sshAttempt(topology, user, host, password);
    }
    case "cat":
    case "less": {
      const path = args[0] ?? "/etc/passwd";
      return catFile(topology, path);
    }
    case "grep": {
      const pattern = args[0] ?? "";
      const rest = args.slice(1).join(" ");
      return grepInFiles(topology, pattern, rest.includes("/") ? rest : undefined);
    }
    case "find": {
      const name = args.includes("-name") ? args[args.indexOf("-name") + 1] ?? "*" : "*";
      return findFiles(topology, name.replaceAll("*", ""));
    }
    case "ls": {
      const dir = (args[0] ?? "/tmp").replace(/\/$/, "") || "/tmp";
      const lines: string[] = [];
      for (const h of topology.hosts) {
        for (const f of h.files) {
          if (f.path === dir || f.path.startsWith(`${dir}/`)) {
            lines.push(`${f.permissions}\troot\troot\t${f.size}\t${f.path}`);
          }
        }
      }
      if (lines.length === 0) {
        return ok(`total 0\nls: cannot access '${dir}': No such file or directory\n`);
      }
      return ok(`total ${lines.length}\n${lines.join("\n")}\n`);
    }
    case "ps":
    case "top": {
      const ipArg = args.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
      const host = ipArg ? findHostByIp(topology, ipArg) : topology.hosts[0];
      const hostId = host?.id;
      const ps = hostId ? payload.processListings[hostId] ?? "" : "";
      return ok(ps || "ps: no data");
    }
    case "netstat":
    case "lsof": {
      const ipArg = args.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
      const host = ipArg ? findHostByIp(topology, ipArg) : topology.hosts[0];
      const hostId = host?.id;
      const ns = hostId ? payload.netstatListings[hostId] ?? "" : "";
      return ok(ns || "netstat: no data");
    }
    case "hydra":
      return hydraHint(topology);
    case "sqlmap":
      return sqlmapSim();
    case "base64": {
      if (args[0] === "-d") {
        return base64op("decode", args.slice(1).join(" "));
      }
      return base64op("encode", args.join(" "));
    }
    case "strings":
      return stringsSim(args[0] ?? "/bin/sh", topology);
    default:
      return err(`${program}: command not found (simulator)`);
  }
}

export function executeRawCommand(
  payload: StoredEnvironmentPayload,
  raw: string,
  parsed: ParsedCommand,
): CommandResult {
  if (parsed.kind === "shell" && parsed.program === "echo") {
    return ok(parsed.args.join(" ") + "\n");
  }
  return executeParsedCommand(payload, parsed);
}
