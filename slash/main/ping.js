module.exports = {
  name: "ping",
  description: "Check bot latency.",
  options: [],
  run: async (client, interaction) => {
    const initialReply = await interaction.reply({ content: "Pinging...", fetchReply: true });
    const messageLatencyMs = initialReply.createdTimestamp - interaction.createdTimestamp;
    const websocketPingMs = Math.round(client.ws.ping);
    return interaction.editReply({ content: `Pong! Latency: ${messageLatencyMs}ms | WS: ${websocketPingMs}ms` });
  },
};