import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus, PayloadTooLargeException } from '@nestjs/common';
import { IdeaError, type IdeaErrorCode } from '@porolympiques/domain';
import type { IdeaErrorDto } from '@porolympiques/shared';
import type { Response } from 'express';

const STATUS: Record<IdeaErrorCode, HttpStatus> = {
  not_found: HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  invalid: HttpStatus.BAD_REQUEST,
  price_tier_required: HttpStatus.BAD_REQUEST,
  duplicate: HttpStatus.CONFLICT,
  votes_frozen: HttpStatus.CONFLICT,
  in_use: HttpStatus.CONFLICT,
  catalog_unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  file_too_large: HttpStatus.PAYLOAD_TOO_LARGE,
  unsupported_file: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
};

/**
 * Traduit un refus du domaine en réponse HTTP, avec son code et son message en français. Un fichier coupé par
 * la limite d'envoi (avant même d'arriver au domaine) reçoit le même message qu'une image trop lourde.
 */
@Catch(IdeaError, PayloadTooLargeException)
export class IdeaErrorFilter implements ExceptionFilter {
  catch(error: IdeaError | PayloadTooLargeException, host: ArgumentsHost): void {
    const refusal = error instanceof IdeaError ? error : new IdeaError('file_too_large', 'Image trop lourde : 2 Mo au maximum.');
    const statusCode = STATUS[refusal.code];
    const body: IdeaErrorDto = { statusCode, code: refusal.code, message: refusal.message };
    host.switchToHttp().getResponse<Response>().status(statusCode).json(body);
  }
}
