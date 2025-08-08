const { EmbedBuilder, Colors } = require("discord.js");
const points = require("../../utils/points.js");

module.exports = {
  name: "leaderboard",
  description: "Show the top players.",
  options: [],
  run: async (client, interaction) => {
    const top = points.getLeaderboard(10);
    const lines = await Promise.all(top.map(async (e, idx) => {
      const user = await client.users.fetch(e.userId).catch(() => null);
      const name = user ? `${user.username}` : e.userId;
      return `#${idx + 1} - **${name}**: ${e.points}`;
    }));
    const embed = new EmbedBuilder()
      .setTitle("Leaderboard")
      .setDescription(lines.length ? lines.join("\n") : "No data yet.")
      .setColor(Colors.Gold);
    return interaction.reply({ embeds: [embed] }).catch(() => {});
  }
};