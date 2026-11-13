import { type DiscordMemberLike, toGuildMember } from './to-guild-member';

describe('toGuildMember', () => {
  it('reprend les champs utiles du membre discord.js', () => {
    const displayAvatarURL = jest.fn().mockReturnValue('https://cdn.discordapp.com/guilds/1/users/2/avatars/a.png?size=256');
    const discordMember: DiscordMemberLike = {
      id: '100000000000000001',
      nickname: 'Ali',
      user: { username: 'alice', globalName: 'Alice', bot: false },
      displayAvatarURL,
    };

    expect(toGuildMember(discordMember)).toEqual({
      discordId: '100000000000000001',
      username: 'alice',
      globalName: 'Alice',
      nickname: 'Ali',
      avatarUrl: 'https://cdn.discordapp.com/guilds/1/users/2/avatars/a.png?size=256',
      isBot: false,
    });
    expect(displayAvatarURL).toHaveBeenCalledWith({ size: 256, extension: 'png' });
  });
});
