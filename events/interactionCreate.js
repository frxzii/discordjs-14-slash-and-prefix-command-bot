const { InteractionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } = require("discord.js");
const client = require("../index.js");
const matchmaker = require("../utils/matchmaker.js");
const points = require("../utils/points.js");
const fs = require("fs");
const path = require("path");
const quizDataPath = path.join(__dirname, "..", "data", "quiz.json");
const unscrambleDataPath = path.join(__dirname, "..", "data", "unscramble.json");
const flagsDataPath = path.join(__dirname, "..", "data", "flags.json");
let QUIZ = [];
let UNSCRAMBLE = [];
let FLAGS = [];
try { QUIZ = JSON.parse(fs.readFileSync(quizDataPath, "utf8")); } catch (e) { QUIZ = []; }
try { UNSCRAMBLE = JSON.parse(fs.readFileSync(unscrambleDataPath, "utf8")); } catch (e) { UNSCRAMBLE = []; }
try { FLAGS = JSON.parse(fs.readFileSync(flagsDataPath, "utf8")); } catch (e) { FLAGS = []; }

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

function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(match) {
  const letters = ["A", "B", "C", "D"];
  if (match.game === "quiz") {
    const q = pickRandom(QUIZ);
    if (!q) return null;
    const correctIndex = q.answer;
    return {
      title: `Round ${match.round}/${match.maxRounds} • Quiz`,
      description: q.q + "\n\n" + q.choices.map((c, i) => `(${letters[i]}) ${c}`).join("\n"),
      choices: q.choices,
      correctIndex,
      color: Colors.Blurple,
      image: null
    };
  }
  if (match.game === "unscramble") {
    const item = pickRandom(UNSCRAMBLE);
    if (!item) return null;
    const word = item.word;
    const scramble = shuffleArray(word.split("")).join("");
    const options = new Set([word]);
    // generate 3 decoys by shuffling until unique and different from word
    while (options.size < 4) {
      const candidate = shuffleArray(word.split("")).join("");
      if (candidate !== word) options.add(candidate);
    }
    const all = shuffleArray(Array.from(options));
    const correctIndex = all.indexOf(word);
    return {
      title: `Round ${match.round}/${match.maxRounds} • Unscramble`,
      description: `Unscramble: **${scramble}**\n\n` + all.map((c, i) => `(${letters[i]}) ${c}`).join("\n"),
      choices: all,
      correctIndex,
      color: Colors.Orange,
      image: null
    };
  }
  if (match.game === "flags") {
    const item = pickRandom(FLAGS);
    if (!item) return null;
    const all = shuffleArray(item.choices);
    const correctIndex = all.indexOf(item.country);
    const imageUrl = `https://flagcdn.com/w320/${item.code}.png`;
    return {
      title: `Round ${match.round}/${match.maxRounds} • Flags`,
      description: `Which country does this flag belong to?\n\n` + all.map((c, i) => `(${letters[i]}) ${c}`).join("\n"),
      choices: all,
      correctIndex,
      color: Colors.Red,
      image: imageUrl
    };
  }
  // fast: quick reaction; present target symbol among 4
  if (match.game === "fast") {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const target = pickRandom(alphabet);
    const pool = shuffleArray(alphabet).filter(x => x !== target).slice(0, 3).concat([target]);
    const all = shuffleArray(pool);
    const correctIndex = all.indexOf(target);
    return {
      title: `Round ${match.round}/${match.maxRounds} • Fast`,
      description: `Be the fastest! Press the target: **${target}**`,
      choices: all,
      correctIndex,
      color: Colors.Green,
      image: null
    };
  }
  return null;
}

async function startNextRound(client, match) {
  if (match.finished) return;
  match.round += 1;
  match.meta = { answered: false };
  if (match.round > match.maxRounds) {
    return finishMatch(client, match);
  }
  const q = buildQuestion(match);
  if (!q) {
    return finishMatch(client, match);
  }
  const letters = ["A", "B", "C", "D"];
  const embed = new EmbedBuilder()
    .setTitle(q.title)
    .setDescription(q.description)
    .setColor(q.color);
  if (q.image) embed.setImage(q.image);
  const buttons = new ActionRowBuilder().addComponents(
    ...q.choices.map((label, i) => new ButtonBuilder()
      .setCustomId(`answer:${match.lobbyId}:${i}:${i === q.correctIndex ? 1 : 0}`)
      .setLabel(letters[i])
      .setStyle(i === q.correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary))
  );
  await broadcastToPlayers(client, match, async () => ({ embeds: [embed], components: [buttons] }));
}

async function finishMatch(client, match) {
  match.finished = true;
  const entries = Array.from(match.scores.entries());
  entries.sort((a, b) => b[1] - a[1]);
  const topScore = entries.length ? entries[0][1] : 0;
  const winners = entries.filter(e => e[1] === topScore).map(e => e[0]);
  for (const [userId] of entries) {
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
