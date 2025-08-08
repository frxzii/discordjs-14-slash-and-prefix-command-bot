const { v4: uuidv4 } = require("uuid");

function makeGameKey(game, players) {
  return `${game}:${players}`;
}

class Matchmaker {
  constructor() {
    this.queueByKey = new Map();
    this.matches = new Map(); // lobbyId -> matchState
  }

  enqueue(game, playersRequired, player) {
    const key = makeGameKey(game, playersRequired);
    if (!this.queueByKey.has(key)) this.queueByKey.set(key, []);
    const q = this.queueByKey.get(key);
    if (q.find(p => p.userId === player.userId)) return null; // already queued
    q.push(player);
    if (q.length >= playersRequired) {
      const selected = q.splice(0, playersRequired);
      return this.createMatch(game, playersRequired, selected);
    }
    return null;
  }

  createMatch(game, playersRequired, players) {
    const lobbyId = uuidv4().slice(0, 8);
    const scores = new Map(players.map(p => [p.userId, 0]));
    const ready = new Set();
    const match = {
      lobbyId,
      game,
      playersRequired,
      players, // {userId, guildId, channelId}
      ready,
      started: false,
      finished: false,
      round: 0,
      maxRounds: 3,
      question: null,
      scores,
      meta: {}
    };
    this.matches.set(lobbyId, match);
    return match;
  }

  getMatch(lobbyId) {
    return this.matches.get(lobbyId);
  }

  setReady(lobbyId, userId) {
    const m = this.matches.get(lobbyId);
    if (!m || m.finished) return null;
    m.ready.add(userId);
    return m;
  }

  allReady(lobbyId) {
    const m = this.matches.get(lobbyId);
    return !!m && m.players.every(p => m.ready.has(p.userId));
  }

  addScore(lobbyId, userId, delta) {
    const m = this.matches.get(lobbyId);
    if (!m) return null;
    m.scores.set(userId, (m.scores.get(userId) || 0) + delta);
    return m.scores.get(userId);
  }

  endMatch(lobbyId) {
    const m = this.matches.get(lobbyId);
    if (!m) return null;
    m.finished = true;
    return m;
  }
}

module.exports = new Matchmaker();