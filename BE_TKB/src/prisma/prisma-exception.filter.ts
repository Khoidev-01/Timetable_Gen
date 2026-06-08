import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Translates Prisma errors into correct HTTP responses instead of leaking a
 * generic 500 "Internal server error".
 *
 * Before this filter, hitting a Prisma constraint (e.g. DELETE on a missing id →
 * P2025, or CREATE with a missing required column → validation error) bubbled up
 * as an unhandled 500, exposing internals and using the wrong status code. Now
 * the common cases map to 400/404/409 with a Vietnamese, user-facing message.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(PrismaExceptionFilter.name);

    catch(
        exception:
            | Prisma.PrismaClientKnownRequestError
            | Prisma.PrismaClientValidationError,
        host: ArgumentsHost,
    ) {
        const res = host.switchToHttp().getResponse<Response>();

        // Validation errors (missing/invalid fields for a query) → 400.
        if (exception instanceof Prisma.PrismaClientValidationError) {
            this.logger.warn(`Prisma validation error: ${exception.message.split('\n').pop()}`);
            return res.status(HttpStatus.BAD_REQUEST).json({
                statusCode: HttpStatus.BAD_REQUEST,
                error: 'Bad Request',
                message: 'Dữ liệu gửi lên không hợp lệ hoặc thiếu trường bắt buộc.',
            });
        }

        // Known request errors — map the most common codes.
        switch (exception.code) {
            case 'P2025': // record not found (update/delete target missing)
                return res.status(HttpStatus.NOT_FOUND).json({
                    statusCode: HttpStatus.NOT_FOUND,
                    error: 'Not Found',
                    message: 'Không tìm thấy bản ghi.',
                });
            case 'P2002': // unique constraint violation
                return res.status(HttpStatus.CONFLICT).json({
                    statusCode: HttpStatus.CONFLICT,
                    error: 'Conflict',
                    message: 'Dữ liệu bị trùng (vi phạm ràng buộc duy nhất).',
                });
            case 'P2003': // foreign key constraint
                return res.status(HttpStatus.BAD_REQUEST).json({
                    statusCode: HttpStatus.BAD_REQUEST,
                    error: 'Bad Request',
                    message: 'Tham chiếu không hợp lệ hoặc bản ghi đang được sử dụng.',
                });
            default:
                this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
                return res.status(HttpStatus.BAD_REQUEST).json({
                    statusCode: HttpStatus.BAD_REQUEST,
                    error: 'Bad Request',
                    message: 'Yêu cầu không thể xử lý.',
                });
        }
    }
}
