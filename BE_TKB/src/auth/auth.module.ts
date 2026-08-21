
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
        // registerAsync, not register: the secret is read when Nest builds the
        // provider rather than when this file is first evaluated. Nothing loads .env
        // explicitly here - Prisma does it as a side effect of being imported - so
        // reading it at module-definition time depends on import order, and reordering
        // AppModule's imports was enough to make the whole app fail to start.
        JwtModule.registerAsync({
            useFactory: () => ({
                secret: requireJwtSecret(),
                signOptions: { expiresIn: JWT_EXPIRES_IN },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService, JwtModule]
})
export class AuthModule { }
