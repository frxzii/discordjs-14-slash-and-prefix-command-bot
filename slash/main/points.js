const { EmbedBuilder, Colors } = require("discord.js");
const points = require("../../utils/points.js");

module.exports = {
  name: "points",
  description: "Show your total points.",
  options: [],
  run: async (client, interaction) => {
    const total = points.getUserPoints(interaction.user.id);
    const embed = new EmbedBuilder()
      .setTitle("Your Points")
      .setDescription(`You have **${total}** points.`)
      .setColor(Colors.Green);
    return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
  }
};