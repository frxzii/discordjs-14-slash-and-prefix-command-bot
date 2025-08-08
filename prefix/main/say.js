exports.run = async (client, message, args) => {
  const text = args.join(" ");
  if (!text) {
    const { prefix } = require("../../config.js");
    return message.reply({ content: `Usage: ${prefix}say <text>` }).catch(() => {});
  }
  return message.channel.send({ content: text });
};
exports.conf = {
  aliases: []
};
exports.help = {
  name: "say"
};