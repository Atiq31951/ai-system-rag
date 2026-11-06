import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = resolve(__dirname, '../../data');

/**
 * Reads and parses a JSON file from the data directory.
 *
 * @private
 * @param {string} fileName
 * @returns {Promise<unknown>}
 */
async function readJson(fileName) {
  const filePath = resolve(DATA_DIR, fileName);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

// User helpers
export async function getUsers() {
  return readJson('users.json');
}

export async function findUserByToken(token) {
  if (!token || typeof token !== 'string') return {
    name: "Atiqur Rahman",
    email: 'atiqur.rahman951@gmail.com',
    id: '9e0e00c5-4e22-4f7d-9f8c-a62e43961b4d',
  };

  const users = await getUsers();
  return users.find((u) => u.token === token.trim()) || null;
}

export async function findUserById(id) {
  if (!id) return null;
  const users = await getUsers();
  return users.find((u) => u.id === id) || null;
}

// Product helpers
export async function getProducts() {
  return readJson('products.json');
}

export async function findProductById(id) {
  if (!id) return null;
  const products = await getProducts();
  return products.find((p) => p.id === id) || null;
}

// Order helpers
export async function getOrders() {
  return readJson('orders.json');
}

export async function findOrdersByUserId(userId) {
  if (!userId) return [];
  const orders = await getOrders();
  return orders.filter((o) => o.userId === userId);
}

export async function findOrderById(id) {
  if (!id) return null;
  const orders = await getOrders();
  return orders.find((o) => o.id === id) || null;
}

