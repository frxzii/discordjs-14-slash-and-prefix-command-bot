const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } = require("discord.js");

module.exports = {
  name: "play",
  description: "Find an online match and play a minigame.",
  options: [
    {
      name: "game",
      description: "Choose the game",
      type: 3,
      required: true,
      choices: [
        { name: "Quiz", value: "quiz" },
        { name: "Unscramble", value: "unscramble" },
        { name: "Flags", value: "flags" },
        { name: "Fast", value: "fast" }
      ]
    },
    {
      name: "players",
      description: "Number of players",
      type: 4,
      required: false,
      choices: [
        { name: "2 players", value: 2 },
        { name: "3 players", value: 3 },
        { name: "4 players", value: 4 }
      ]
    }
  ],
  run: async (client, interaction) => {
    const game = interaction.options.getString("game", true);
    const players = interaction.options.getInteger("players") || 2;

    const embed = new EmbedBuilder()
      .setTitle("Online Matchmaking")
      .setDescription(`Game: **${game}**\nPlayers: **${players}**\nPress Join to enter the global queue. When a match is found, you will get a Ready prompt.`)
      .setColor(Colors.Blue);

    const joinBtn = new ButtonBuilder()
      .setCustomId(`queue_join:${game}:${players}`)
      .setStyle(ButtonStyle.Success)
      .setLabel("Join Queue");

    const row = new ActionRowBuilder().addComponents(joinBtn);
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true }).catch(() => {});
  }
};