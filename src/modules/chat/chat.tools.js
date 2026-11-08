import { config } from '../../config/index.js';
import {
  getProducts,
  findOrdersByUserId,
  findOrderById,
  findShipmentByOrderId,
} from '../../infrastructure/data-store.js';

/**
 * Returns today's date in YYYY-MM-DD format. Uses config.appToday if set, else UTC date.
 *
 * @returns {string}
 */
export function getToday() {
  if (config.appToday) {
    return config.appToday;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Validates that a date value is YYYY-MM-DD, a real date, not in the future,
 * and not more than 365 days in the past.
 *
 * @param {string} value
 * @param {string} fieldName
 * @returns {string|null}
 */
export function checkDate(value, fieldName) {
  const errorMsg = `${fieldName} '${value}' looks wrong (today is unknown to you). Call getCurrentDate first, then getDateDaysAgo, and use those results.`;

  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return errorMsg;
  }

  const d = new Date(`${value}T00:00:00Z`);
  if (isNaN(d.getTime())) {
    return errorMsg;
  }

  const todayStr = getToday();
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  if (d > todayDate) {
    return errorMsg;
  }

  const oneYearAgo = new Date(`${todayStr}T00:00:00Z`);
  oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 365);
  if (d < oneYearAgo) {
    return errorMsg;
  }

  return null;
}

/**
 * Tool definitions in Ollama / OpenAI function format.
 */
export const tools = [
  {
    type: 'function',
    function: {
      name: 'getCurrentDate',
      description: 'Get the current date as { date: "YYYY-MM-DD" }. Use this when calculating dates for relative time questions.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDateDaysAgo',
      description: 'Subtract a number of days from a reference date in UTC. Returns { date: "YYYY-MM-DD" }. Date must match getCurrentDate result.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Reference date in YYYY-MM-DD format (must be the result of getCurrentDate)',
          },
          days: {
            type: 'number',
            description: 'Number of days to subtract (0 to 365)',
          },
        },
        required: ['date', 'days'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMyOrders',
      description: 'Get all orders belonging to the customer, optionally filtered by date range (fromDate and toDate in YYYY-MM-DD format, inclusive).',
      parameters: {
        type: 'object',
        properties: {
          fromDate: {
            type: 'string',
            description: 'Optional start date in YYYY-MM-DD format (inclusive)',
          },
          toDate: {
            type: 'string',
            description: 'Optional end date in YYYY-MM-DD format (inclusive)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getOrderById',
      description: 'Get details of a specific order by its order ID (e.g. ord-101). Only accessible if it belongs to the logged in customer.',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'The unique order ID, e.g. ord-101',
          },
        },
        required: ['orderId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getShipmentTracking',
      description: 'Get shipment tracking events and status for an order by order ID. Use when customer asks where their order is, why it is delayed, or what the problem is.',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'The unique order ID, e.g. ord-101',
          },
        },
        required: ['orderId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description: 'Search products in the catalog by name or category keyword. Returns product names, categories, prices, and stock.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search term (product name or category, e.g. headphones, chair, apparel)',
          },
        },
        required: ['query'],
      },
    },
  },
];

/**
 * Enriches an order object with product details, calculated totals, and statusNote.
 *
 * @param {Object} order
 * @param {Array<Object>} products
 * @returns {Object}
 */
function enrichOrder(order, products) {
  let totalAmount = 0;
  const items = order.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const price = product ? product.price : 0;
    const itemTotal = Number((price * item.qty).toFixed(2));
    totalAmount += itemTotal;

    return {
      productId: item.productId,
      productName: product ? product.name : 'Unknown Product',
      price,
      qty: item.qty,
      itemTotal,
    };
  });

  return {
    id: order.id,
    status: order.status,
    statusNote: order.statusNote || null,
    createdAt: order.createdAt,
    items,
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}

/**
 * Returns current date in YYYY-MM-DD. Uses getToday().
 *
 * @returns {{ date: string }}
 */
function getCurrentDate() {
  return { date: getToday() };
}

/**
 * Calculates a past date in UTC.
 *
 * @param {Object} args
 * @param {string} args.date - Reference date (must equal getToday())
 * @param {number|string} args.days - number between 0 and 365
 * @returns {{ date: string } | { error: string }}
 */
function getDateDaysAgo({ date, days } = {}) {
  const today = getToday();
  if (date !== today) {
    return { error: "Wrong base date. Call getCurrentDate and pass its exact result as 'date'." };
  }

  const numDays = typeof days === 'string' ? Number(days) : days;
  if (typeof numDays !== 'number' || numDays < 0 || numDays > 365 || isNaN(numDays)) {
    return { error: 'days must be a number between 0 and 365.' };
  }

  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - numDays);
  return { date: d.toISOString().split('T')[0] };
}

/**
 * Retrieves orders for the authenticated user, optionally filtered by date range.
 *
 * @param {Object} [args]
 * @param {string} [args.fromDate] - YYYY-MM-DD (inclusive)
 * @param {string} [args.toDate] - YYYY-MM-DD (inclusive)
 * @param {Object|null} user
 * @returns {Promise<Object>}
 */
async function getMyOrders({ fromDate, toDate } = {}, user) {
  if (!user) {
    return { error: 'login required' };
  }

  if (fromDate) {
    const err = checkDate(fromDate, 'fromDate');
    if (err) return { error: err };
  }

  if (toDate) {
    const err = checkDate(toDate, 'toDate');
    if (err) return { error: err };
  }

  if (fromDate && toDate && fromDate > toDate) {
    return { error: 'fromDate must be before toDate. Swap them.' };
  }

  try {
    const [orders, products] = await Promise.all([
      findOrdersByUserId(user.id),
      getProducts(),
    ]);

    let filtered = orders;
    if (fromDate || toDate) {
      filtered = filtered.filter((order) => {
        const orderDate = order.createdAt.split('T')[0];
        if (fromDate && orderDate < fromDate) return false;
        if (toDate && orderDate > toDate) return false;
        return true;
      });
    }

    const enriched = filtered.map((order) => enrichOrder(order, products));
    return { orders: enriched };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Retrieves a single order by ID for the authenticated user.
 *
 * @param {Object} args
 * @param {string} args.orderId
 * @param {Object|null} user
 * @returns {Promise<Object>}
 */
async function getOrderById({ orderId } = {}, user) {
  if (!user) {
    return { error: 'login required' };
  }

  if (!orderId) {
    return { error: 'orderId is required' };
  }

  const order = await findOrderById(orderId);
  if (!order) {
    return { error: `Order ${orderId} not found` };
  }

  // Security check: Customer can ONLY access their own orders
  if (order.userId !== user.id) {
    return { error: 'Access denied. This order does not belong to you.' };
  }

  const products = await getProducts();
  return { order: enrichOrder(order, products) };
}

/**
 * Retrieves shipment tracking information for an order belonging to the user.
 *
 * @param {Object} args
 * @param {string} args.orderId
 * @param {Object|null} user
 * @returns {Promise<Object>}
 */
async function getShipmentTracking({ orderId } = {}, user) {
  if (!user) {
    return { error: 'login required' };
  }

  if (!orderId) {
    return { error: 'orderId is required' };
  }

  const order = await findOrderById(orderId);
  if (!order) {
    return { error: `Order ${orderId} not found` };
  }

  if (order.userId !== user.id) {
    return { error: 'Access denied. This order does not belong to you.' };
  }

  const shipment = await findShipmentByOrderId(orderId);
  if (!shipment) {
    return {
      message: 'Not shipped yet',
      statusNote: order.statusNote || 'No additional note',
    };
  }

  return { shipment };
}

/**
 * Searches the catalog for products matching name or category.
 *
 * @param {Object} args
 * @param {string} args.query
 * @returns {Promise<Object>}
 */
async function searchProducts({ query } = {}) {
  if (!query || typeof query !== 'string') {
    return { products: [] };
  }

  const term = query.toLowerCase().trim();
  const products = await getProducts();

  const matches = products.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
  );

  return { products: matches };
}

/**
 * Central tool runner. Calls the appropriate function based on tool name.
 * The user always comes from the server context, never from model arguments.
 *
 * @param {string} name - Name of the tool
 * @param {Record<string, unknown>} args - Arguments passed by the model
 * @param {Object|null} user - The authenticated user or null
 * @returns {Promise<Object>}
 */
export async function runTool(name, args = {}, user) {
  if (name === 'getCurrentDate') {
    return getCurrentDate();
  }
  if (name === 'getDateDaysAgo') {
    return getDateDaysAgo(args);
  }
  if (name === 'getMyOrders') {
    return getMyOrders(args, user);
  }
  if (name === 'getOrderById') {
    return getOrderById(args, user);
  }
  if (name === 'getShipmentTracking') {
    return getShipmentTracking(args, user);
  }
  if (name === 'searchProducts') {
    return searchProducts(args);
  }
  return { error: `Unknown tool: ${name}` };
}
