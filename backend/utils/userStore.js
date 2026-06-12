const fs = require('fs-extra');
const path = require('path');

const USERS_FILE = path.join(__dirname, '../data/users.json');

async function getUsers() {
  await fs.ensureFile(USERS_FILE);
  const content = await fs.readFile(USERS_FILE, 'utf-8').catch(() => '[]');
  try { return JSON.parse(content); } catch { return []; }
}

async function saveUsers(users) {
  await fs.ensureDir(path.dirname(USERS_FILE));
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function findUser(username) {
  const users = await getUsers();
  return users.find(u => u.username === username) || null;
}

async function findUserById(id) {
  const users = await getUsers();
  return users.find(u => u.id === id) || null;
}

async function createUser(userData) {
  const users = await getUsers();
  users.push(userData);
  await saveUsers(users);
  return userData;
}

module.exports = { getUsers, findUser, findUserById, createUser };
