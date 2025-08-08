const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const POINTS_FILE = path.join(DATA_DIR, "points.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(POINTS_FILE)) fs.writeFileSync(POINTS_FILE, JSON.stringify({}, null, 2));
}

function readStore() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(POINTS_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  ensureDataFile();
  fs.writeFileSync(POINTS_FILE, JSON.stringify(store, null, 2));
}

module.exports = {
  getUserPoints(userId) {
    const store = readStore();
    return Number(store[userId] || 0);
  },
  addUserPoints(userId, amount) {
    const store = readStore();
    store[userId] = Number(store[userId] || 0) + Number(amount || 0);
    writeStore(store);
    return store[userId];
  },
  getLeaderboard(limit = 10) {
    const store = readStore();
    const entries = Object.entries(store).map(([userId, points]) => ({ userId, points: Number(points) }));
    entries.sort((a, b) => b.points - a.points);
    return entries.slice(0, limit);
  }
};