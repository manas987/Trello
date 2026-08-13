import type { Request, Response, NextFunction } from "express";

export type routes = {
  request: Request;
  response: Response;
  nextfunction: NextFunction;
};
