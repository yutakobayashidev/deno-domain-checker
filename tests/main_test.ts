import {
  assert,
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std/assert/mod.ts";
import { DomainStatus } from "../main.ts";

Deno.env.set("DOMAINS", "example.com,example.org");
Deno.env.set("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/mock");

import { createNotificationPayload, findRdapServer } from "../main.ts";

Deno.test("findRdapServer should return a valid URL for common TLDs", async () => {
  const server = await findRdapServer("com");
  assertNotEquals(server, null);
  assert(server?.includes("http"), "Server URL should include http protocol");
});

Deno.test("createNotificationPayload should generate correct payload for available domain", () => {
  const status: DomainStatus = {
    domain: "example.com",
    isAvailable: true,
    status: ["Available for registration"],
    timestamp: new Date(),
  };

  const payload = createNotificationPayload(status);

  assertEquals(typeof payload, "object");
  assertStringIncludes(payload.content, "available");
  assertEquals(payload.embeds.length, 1);
  assertStringIncludes(payload.embeds[0].title, "Domain Available");
  assertEquals(payload.embeds[0].color, 5814783); // Green color for available
});

Deno.test("createNotificationPayload should generate correct payload for unavailable domain", () => {
  const status: DomainStatus = {
    domain: "example.com",
    isAvailable: false,
    status: ["registered"],
    registrar: "Example Registrar",
    expiryDate: "2023-12-31",
    timestamp: new Date(),
  };

  const payload = createNotificationPayload(status);

  assertEquals(typeof payload, "object");
  assertStringIncludes(payload.content, "status");
  assertEquals(payload.embeds.length, 1);
  assertStringIncludes(payload.embeds[0].title, "Domain Status Update");
  assertEquals(payload.embeds[0].color, 15548997); // Red color for unavailable
});

Deno.test("createNotificationPayload should generate correct payload for redemption domain", () => {
  const status: DomainStatus = {
    domain: "example.com",
    isAvailable: false,
    status: ["redemption period"],
    timestamp: new Date(),
  };

  const payload = createNotificationPayload(status);

  assertEquals(typeof payload, "object");
  assertEquals(payload.embeds[0].color, 16776960); // Yellow color for redemption
  assertStringIncludes(payload.embeds[0].description, "redemption period");
});
