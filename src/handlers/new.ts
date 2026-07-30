import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { now } from "../clock.js";
import { saveLead, type DurableLeadStore, type Lead } from "../lead-store.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "New lead", data: "lead:new", order: 10 });

const composer = new Composer<Ctx>();

const cancelKeyboard = inlineKeyboard([[inlineButton("Cancel", "lead:cancel")]]);
const menuKeyboard = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

function clearDraft(ctx: Ctx): void {
  ctx.session.step = "idle";
  ctx.session.leadDraft = undefined;
}

async function askForName(ctx: Ctx): Promise<void> {
  ctx.session.step = "awaiting_name";
  ctx.session.leadDraft = {};
  await ctx.reply("What is your full name?", {
    reply_markup: cancelKeyboard,
  });
}

async function beginLead(ctx: Ctx): Promise<void> {
  await askForName(ctx);
}

function validName(value: string): boolean {
  return value.length >= 2 && value.length <= 100;
}

function validPhone(value: string): boolean {
  return /^[+]?[-. ()0-9]{7,25}$/.test(value) && /\d/.test(value);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function summary(ctx: Ctx): string {
  const draft = ctx.session.leadDraft;
  return `Please check your details.\n\nName: ${draft?.name}\nPhone: ${draft?.phone}\nEmail: ${draft?.email}`;
}

function confirmationKeyboard() {
  return inlineKeyboard([
    [inlineButton("Confirm", "lead:confirm"), inlineButton("Edit", "lead:edit")],
    [inlineButton("Cancel", "lead:cancel")],
  ]);
}

function adminChatId(ctx: Ctx): string | undefined {
  const workerEnv = (ctx as Ctx & { env?: { ADMIN_CHAT_ID?: string } }).env;
  if (workerEnv?.ADMIN_CHAT_ID) return workerEnv.ADMIN_CHAT_ID;
  return typeof process === "undefined" ? undefined : process.env.ADMIN_CHAT_ID;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function adminNotification(lead: Lead): string {
  return "<b>New real-estate lead</b>\n\n" +
    `Name: ${escapeHtml(lead.name)}\n` +
    `Phone: ${escapeHtml(lead.phone)}\n` +
    `Email: ${escapeHtml(lead.email)}\n` +
    `User: <a href=\"tg://user?id=${lead.userId}\">Open profile</a>`;
}

async function notifyAdmin(ctx: Ctx, lead: Lead): Promise<"sent" | "not_configured" | "unavailable"> {
  const chatId = adminChatId(ctx);
  if (!chatId) return "not_configured";
  try {
    await ctx.api.sendMessage(chatId, adminNotification(lead), { parse_mode: "HTML" });
    return "sent";
  } catch {
    return "unavailable";
  }
}

composer.command("new", beginLead);
composer.callbackQuery("lead:new", async (ctx) => {
  await ctx.answerCallbackQuery();
  await beginLead(ctx);
});

composer.callbackQuery("lead:cancel", async (ctx) => {
  clearDraft(ctx);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Your lead submission was cancelled.", { reply_markup: menuKeyboard });
});

composer.callbackQuery("lead:edit", async (ctx) => {
  await ctx.answerCallbackQuery();
  await askForName(ctx);
});

composer.callbackQuery("lead:confirm", async (ctx) => {
  const draft = ctx.session.leadDraft;
  const userId = ctx.from?.id;
  if (!userId || !draft?.name || !draft.phone || !draft.email) {
    clearDraft(ctx);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Your draft is no longer available. Start a new lead when you're ready.", {
      reply_markup: menuKeyboard,
    });
    return;
  }
  const lead: Lead = {
    name: draft.name,
    phone: draft.phone,
    email: draft.email,
    timestamp: now().toISOString(),
    message: "",
    confirmed: true,
    userId,
  };
  await saveLead(lead, (ctx as Ctx & { env?: { CHAT_DO?: DurableLeadStore["CHAT_DO"] } }).env);
  clearDraft(ctx);
  const notified = await notifyAdmin(ctx, lead);
  await ctx.answerCallbackQuery();
  const text = notified === "sent"
    ? "Your details have been sent. Our real-estate team will be in touch."
    : notified === "not_configured"
      ? "Your details have been saved. The team notification isn't set up yet."
      : "Your details have been saved. We couldn't reach the team notification chat just now.";
  await ctx.editMessageText(text, { reply_markup: menuKeyboard });
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.step;
  if (step !== "awaiting_name" && step !== "awaiting_phone" && step !== "awaiting_email") {
    return next();
  }
  const value = ctx.message.text.trim();
  if (step === "awaiting_name") {
    if (!validName(value)) {
      await ctx.reply("Enter your full name so our team knows how to address you.", { reply_markup: cancelKeyboard });
      return;
    }
    ctx.session.leadDraft = { ...ctx.session.leadDraft, name: value };
    ctx.session.step = "awaiting_phone";
    await ctx.reply("What phone number should we use?", { reply_markup: cancelKeyboard });
    return;
  }
  if (step === "awaiting_phone") {
    if (!validPhone(value)) {
      await ctx.reply("That phone number doesn't look right. Enter a number with at least seven digits.", { reply_markup: cancelKeyboard });
      return;
    }
    ctx.session.leadDraft = { ...ctx.session.leadDraft, phone: value };
    ctx.session.step = "awaiting_email";
    await ctx.reply("What email address should we use?", { reply_markup: cancelKeyboard });
    return;
  }
  if (!validEmail(value)) {
    await ctx.reply("That email address doesn't look right. Check it and try again.", { reply_markup: cancelKeyboard });
    return;
  }
  ctx.session.leadDraft = { ...ctx.session.leadDraft, email: value };
  ctx.session.step = "confirming";
  await ctx.reply(summary(ctx), { reply_markup: confirmationKeyboard() });
});

export default composer;
