import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private usersService;
    private jwtService;
    private readonly SECRET;
    constructor(usersService: UsersService, jwtService: JwtService);
    createCaptcha(): {
        img: string;
        sessionId: string;
    };
    validateCaptcha(code: string, sessionId: string): boolean;
    validateUser(username: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
        user: any;
    }>;
}
