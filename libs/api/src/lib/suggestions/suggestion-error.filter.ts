import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { SuggestionError, type SuggestionErrorCode } from '@porolympiques/domain';
import type { SuggestionErrorDto } from '@porolympiques/shared';
import type { Response } from 'express';

const STATUS: Record<SuggestionErrorCode, HttpStatus> = {
  not_found: HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  invalid: HttpStatus.BAD_REQUEST,
  votes_frozen: HttpStatus.CONFLICT,
};

/** Traduit un refus du domaine en réponse HTTP, avec son code et son message en français. */
@Catch(SuggestionError)
export class SuggestionErrorFilter implements ExceptionFilter {
  catch(error: SuggestionError, host: ArgumentsHost): void {
    const statusCode = STATUS[error.code];
    const body: SuggestionErrorDto = { statusCode, code: error.code, message: error.message };
    host.switchToHttp().getResponse<Response>().status(statusCode).json(body);
  }
}
