
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { getJwtSecret } from './jwt.config';

@Module({
    imports: [
        PrismaModule,
        PassportModule,
        JwtModule.register({
            secret: getJwtSecret(),
            signOptions: { expiresIn: '1d' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtAuthGuard, AdminGuard],
    exports: [AuthService, JwtModule, JwtAuthGuard, AdminGuard]
})
export class AuthModule { }
