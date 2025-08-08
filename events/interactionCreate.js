const { InteractionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } = require("discord.js");
const client = require("../index.js");
const matchmaker = require("../utils/matchmaker.js");
const points = require("../utils/points.js");
const fs = require("fs");
const path = require("path");
const quizDataPath = path.join(__dirname, "..", "data", "quiz.json");
let QUIZ = [];
try { QUIZ = JSON.parse(fs.readFileSync(quizDataPath, "utf8")); } catch (e) { QUIZ = []; }

async function broadcastToPlayers(client, match, payloadFactory) {
  for (const p of match.players) {
    try {
      const ch = await client.channels.fetch(p.channelId).catch(() => null);
      if (!ch) continue;
      const payload = await payloadFactory(p);
      await ch.send(payload).catch(() => {});
    } catch (_) {}
  }
}

function pickRandomQuestion() {
  if (!QUIZ.length) return null;
  const idx = Math.floor(Math.random() * QUIZ.length);
  return QUIZ[idx];
}

async function startNextRound(client, match) {
  if (match.finished) return;
  match.round += 1;
  match.meta = { answered: false };
  if (match.round > match.maxRounds) {
    return finishMatch(client, match);
  }
  const q = pickRandomQuestion();
  match.question = q;
  if (!q) {
    return finishMatch(client, match);
  }
  const letters = ["A", "B", "C", "D"];
  const embed = new EmbedBuilder()
    .setTitle(`Round ${match.round}/${match.maxRounds}`)
    .setDescription(`${q.q}\n\n` + q.choices.map((c, i) => `(${letters[i]}) ${c}`).join("\n"))
    .setColor(Colors.Blurple);
  const buttons = new ActionRowBuilder().addComponents(
    ...q.choices.map((_, i) => new ButtonBuilder()
      .setCustomId(`answer:${match.lobbyId}:${i}:${i === q.answer ? 1 : 0}`)
      .setLabel(letters[i])
      .setStyle(i === q.answer ? ButtonStyle.Success : ButtonStyle.Secondary))
  );
  await broadcastToPlayers(client, match, async () => ({ embeds: [embed], components: [buttons] }));
}

async function finishMatch(client, match) {
  match.finished = true;
  // compute winners
  const entries = Array.from(match.scores.entries());
  entries.sort((a, b) => b[1] - a[1]);
  const topScore = entries.length ? entries[0][1] : 0;
  const winners = entries.filter(e => e[1] === topScore).map(e => e[0]);
  // awards
  for (const [userId, sc] of entries) {
    const reward = winners.includes(userId) ? 10 : 3;
    points.addUserPoints(userId, reward);
  }
  await broadcastToPlayers(client, match, async () => ({ content: `Match ${match.lobbyId} finished. Winners: ${winners.map(w => `<@${w}>`).join(", ") || "None"}.` }));
}

client.on("interactionCreate", async (interaction) => {

  if(!interaction.guild) return;
  if(interaction.user.bot) return;

  if (interaction.type === InteractionType.ApplicationCommand) {

    const command = client.slashCommands.get(interaction.commandName);
    if (command) {
      try {
        await command.run(client, interaction);
      } catch (error) {
        console.log(error);
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      }
    }

  } else if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
    const id = interaction.customId || "";
    try {
      if (id.startsWith("queue_join:")) {
        const [, game, playersStr] = id.split(":");
        const playersRequired = Math.max(2, Math.min(4, Number(playersStr || 2)));
        const player = { userId: interaction.user.id, guildId: interaction.guild.id, channelId: interaction.channel.id };
        const match = matchmaker.enqueue(game, playersRequired, player);
        await interaction.reply({ content: "You joined the queue. You'll be matched soon.", ephemeral: true }).catch(() => {});
        if (match) {
          await broadcastToPlayers(client, match, async (p) => {
            const readyBtn = new ButtonBuilder()
              .setCustomId(`match_ready:${match.lobbyId}`)
              .setLabel("Ready")
              .setStyle(ButtonStyle.Primary);
            const row = new ActionRowBuilder().addComponents(readyBtn);
            const embed = new EmbedBuilder()
              .setTitle(`Match Found (${match.game})`)
              .setDescription(`Lobby: ${match.lobbyId}\nPlayers: ${match.players.map(x => `<@${x.userId}>`).join(", ")}`)
              .setColor(Colors.Green);
            return { content: `<@${p.userId}>`, embeds: [embed], components: [row] };
          });
        }
      } else if (id.startsWith("match_ready:")) {
        const [, lobbyId] = id.split(":");
        const m = matchmaker.setReady(lobbyId, interaction.user.id);
        if (!m) return interaction.reply({ content: "Match not found or finished.", ephemeral: true }).catch(() => {});
        await interaction.reply({ content: "You are ready!", ephemeral: true }).catch(() => {});
        if (!m.started && matchmaker.allReady(lobbyId)) {
          m.started = true;
          await broadcastToPlayers(client, m, async () => ({ content: `All players ready. Starting match ${m.lobbyId}...` }));
          await startNextRound(client, m);
        }
      } else if (id.startsWith("answer:")) {
        const [, lobbyId, idxStr, isCorrectStr] = id.split(":");
        const m = matchmaker.getMatch(lobbyId);
        if (!m || !m.started || m.finished) return interaction.reply({ content: "Match is not active.", ephemeral: true }).catch(() => {});
        const isParticipant = m.players.some(p => p.userId === interaction.user.id);
        if (!isParticipant) return interaction.reply({ content: "You are not in this match.", ephemeral: true }).catch(() => {});
        if (m.meta.answered) return interaction.reply({ content: "Round already decided.", ephemeral: true }).catch(() => {});
        const isCorrect = isCorrectStr === "1";
        if (isCorrect) {
          m.meta.answered = true;
          matchmaker.addScore(lobbyId, interaction.user.id, 1);
          await broadcastToPlayers(client, m, async () => ({ content: `Round ${m.round}: <@${interaction.user.id}> answered correctly!` }));
          // next round or finish
          await startNextRound(client, m);
          return interaction.deferUpdate().catch(() => {});
        } else {
          return interaction.reply({ content: "Wrong answer!", ephemeral: true }).catch(() => {});
        }
      }
    } catch (e) {
      console.log(e);
      try { await interaction.reply({ content: "Error handling action.", ephemeral: true }); } catch (_) {}
    }
  }

});
