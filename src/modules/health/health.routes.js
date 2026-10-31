import { Router } from 'express';

/**
 * Health check controller.
 *
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
export function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

const router = Router();
router.get('/', getHealth);

export const healthRoutes = router;
