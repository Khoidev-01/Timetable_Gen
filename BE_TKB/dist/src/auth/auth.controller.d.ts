import { AuthService } from './auth.service';
import type { Response } from 'express';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    getCaptcha(res: Response): Promise<void>;
    login(body: any): Promise<{
        access_token: string;
        user: any;
    }>;
}
