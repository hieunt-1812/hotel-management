import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { catchError, Observable, throwError } from 'rxjs';

/**
 * Multer saves files to disk before DTO validation runs. If the request then
 * fails (400 validation, 409, 500...), remove those files so they don't pile up.
 * Must be listed AFTER the File(s)Interceptor in @UseInterceptors.
 */
@Injectable()
export class DeleteUploadsOnErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      catchError((error) => {
        const files: Express.Multer.File[] = [
          ...(req.file ? [req.file] : []),
          ...(Array.isArray(req.files) ? req.files : []),
        ];
        // Best effort: a failed unlink must not hide the original error
        void Promise.allSettled(files.map((file) => unlink(file.path)));
        return throwError(() => error);
      }),
    );
  }
}
