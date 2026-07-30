import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.

registerMainMenuItem({ label: "Privacy", data: "privacy:show", order: 20 });

const composer = new Composer<Ctx>();

const PRIVACY =
  "We collect your name, phone number, and email only to respond to your property enquiry.\n\n" +
  "Your details are stored securely and shared with the real-estate team handling your request.";

const backToMenu = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

composer.command("privacy", async (ctx) => {
  await ctx.reply(PRIVACY, { reply_markup: backToMenu });
});

composer.callbackQuery("privacy:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(PRIVACY, { reply_markup: backToMenu });
});

export default composer;
