import type { Request, Response } from "express";
import { logger } from "../../libs/logger";
import { post, get } from "../use-cases";

const baseUrl = "/api/v1";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Ett oväntat fel inträffade";
}

function stripPassword<T extends Record<string, unknown>>(user: T): Omit<T, "password"> {
  const { password: _removed, ...safe } = user;
  return safe;
}

function stripPasswords(users: unknown): unknown[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) =>
    typeof u === "object" && u !== null
      ? stripPassword(u as Record<string, unknown>)
      : u
  );
}

const getEP = async (_req: Request, res: Response) => {
  try {
    const results = await get();
    res.json({ err: 0, data: stripPasswords(results) });
  } catch (err) {
    logger.info(`[EP][GET] ${errorMessage(err)}`);
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const postEP = async (req: Request, res: Response) => {
  try {
    const results = await post({ params: req.body });
    res.status(201).json({
      err: 0,
      data: stripPassword(results as Record<string, unknown>),
    });
  } catch (err) {
    logger.info(`[EP][POST] ${errorMessage(err)}`);
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const routes = [
  { path: `${baseUrl}/`, method: "get" as const, component: getEP },
  { path: `${baseUrl}/`, method: "post" as const, component: postEP },
];

export { routes };
