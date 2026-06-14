import { WebClient } from "@slack/web-api";
import type { ChatPostMessageArguments, KnownBlock } from "@slack/web-api";

const MAX_ATTEMPTS = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class SlackApiClient {
  private readonly client: WebClient;

  constructor(botToken: string) {
    this.client = new WebClient(botToken, { retryConfig: { retries: 0 } });
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let last: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        if (attempt === MAX_ATTEMPTS) break;
        await sleep(2 ** (attempt - 1) * 200);
      }
    }
    throw last instanceof Error ? last : new Error(String(last));
  }

  async postMessage(
    channel: string,
    text: string,
    blocks?: KnownBlock[],
  ): Promise<{ ts?: string; channel?: string }> {
    const args: ChatPostMessageArguments = { channel, text, blocks };
    const res = await this.withRetry(() => this.client.chat.postMessage(args));
    if (!res.ok) {
      throw new Error(res.error ?? "chat.postMessage failed");
    }
    return { ts: res.ts, channel: res.channel };
  }

  async sendDM(userId: string, text: string, blocks?: KnownBlock[]): Promise<void> {
    const open = await this.withRetry(() => this.client.conversations.open({ users: userId }));
    if (!open.ok || !open.channel?.id) {
      throw new Error(open.error ?? "conversations.open failed");
    }
    await this.postMessage(open.channel.id, text, blocks);
  }

  async updateMessage(
    channel: string,
    ts: string,
    text: string,
    blocks?: KnownBlock[],
  ): Promise<void> {
    const res = await this.withRetry(() =>
      this.client.chat.update({ channel, ts, text, blocks }),
    );
    if (!res.ok) {
      throw new Error(res.error ?? "chat.update failed");
    }
  }

  async getUserInfo(userId: string) {
    const res = await this.withRetry(() => this.client.users.info({ user: userId }));
    if (!res.ok) {
      throw new Error(res.error ?? "users.info failed");
    }
    return res.user;
  }

  async getChannelInfo(channelId: string) {
    const res = await this.withRetry(() => this.client.conversations.info({ channel: channelId }));
    if (!res.ok) {
      throw new Error(res.error ?? "conversations.info failed");
    }
    return res.channel;
  }

  /**
   * Slack rotating refresh tokens (if present). No-op if Slack returns invalid_auth without refresh path.
   */
  async refreshAccessTokenIfNeeded(refreshToken: string | null): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  }> {
    void refreshToken;
    return { accessToken: null, refreshToken: null };
  }
}

export function createSlackClient(botToken: string): SlackApiClient {
  return new SlackApiClient(botToken);
}
