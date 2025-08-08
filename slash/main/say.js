module.exports = {
  name: "say",
  description: "Echo a message.",
  options: [
    {
      name: "text",
      description: "The text to send.",
      type: 3,
      required: true,
    },
  ],
  run: async (client, interaction) => {
    const text = interaction.options.getString("text", true);
    await interaction.reply({ content: "✅ Sent.", ephemeral: true }).catch(() => {});
    return interaction.channel.send({ content: text });
  },
};