import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { EventError, type EventErrorCode } from '@porolympiques/domain';
import type { EventErrorDto } from '@porolympiques/shared';
import type { Response } from 'express';

const STATUS: Record<EventErrorCode, HttpStatus> = {
  not_found: HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  invalid: HttpStatus.BAD_REQUEST,
  closed: HttpStatus.CONFLICT,
  conflict: HttpStatus.CONFLICT,
};

/** Traduit un refus du domaine (saisons, events, choix du jeu) en réponse HTTP, avec son message en français. */
@Catch(EventError)
export class EventErrorFilter implements ExceptionFilter {
  catch(error: EventError, host: ArgumentsHost): void {
    const statusCode = STATUS[error.code];
    const body: EventErrorDto = { statusCode, code: error.code, message: error.message };
    host.switchToHttp().getResponse<Response>().status(statusCode).json(body);
  }
}
