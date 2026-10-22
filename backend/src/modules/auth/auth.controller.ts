import { Request, Response } from "express";
import type { AuthService } from "./auth.service";

export class AuthController {
  constructor(private service: AuthService) {}

  register = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.register(req.body));
  };

  login = async (req: Request, res: Response) => {
    res.json(await this.service.login(req.body));
  };

  me = (req: Request, res: Response) => {
    res.json({ user: req.user });
  };
}