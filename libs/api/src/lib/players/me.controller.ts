import { Controller, Get } from '@nestjs/common';
import type { Player } from '@porolympiques/domain';
import type { MeDto } from '@porolympiques/shared';
import { CurrentPlayer } from '../auth/current-player.decorator';

@Controller('me')
export class MeController {
  @Get()
  me(@CurrentPlayer() player: Player): MeDto {
    return { id: player.id, pseudo: player.pseudo, avatarUrl: player.avatarUrl, role: player.role };
  }
}
