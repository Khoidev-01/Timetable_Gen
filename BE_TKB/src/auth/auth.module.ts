
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JWT_EXPIRES_IN, requireJwtSecret } from './jwt.constants';

@Module({
    imports: [
        PrismaModule,
        PassportModule,
        JwtModule.register({
            secret: requireJwtSecret(),
            signOptions: { expiresIn: JWT_EXPIRES_IN },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService, JwtModule]
})
export class AuthModule { }
