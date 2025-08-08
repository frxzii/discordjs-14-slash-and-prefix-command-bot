exports.run = async (client, message, args) => {
  const sent = await message.reply({ content: "Pinging..." });
  const messageLatencyMs = sent.createdTimestamp - message.createdTimestamp;
  const websocketPingMs = Math.round(client.ws.ping);
  return sent.edit({ content: `Pong! Latency: ${messageLatencyMs}ms | WS: ${websocketPingMs}ms` });
};
exports.conf = {
  aliases: []
};
exports.help = {
  name: "ping"
};