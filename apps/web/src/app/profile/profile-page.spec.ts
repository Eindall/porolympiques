import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth.service';
import { ProfilePage } from './profile-page';

describe('ProfilePage', () => {
  const logout = vi.fn().mockResolvedValue(undefined);

  function render(role: 'admin' | 'player'): HTMLElement {
    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        {
          provide: AuthService,
          useValue: { me: () => ({ id: 'p-1', pseudo: 'Alice', avatarUrl: 'https://cdn.discordapp.com/a.png', role }), logout },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('affiche le pseudo et l’avatar', () => {
    const page = render('player');

    expect(page.querySelector('h1')?.textContent).toContain('Alice');
    expect(page.querySelector('img')?.getAttribute('src')).toBe('https://cdn.discordapp.com/a.png');
    expect(page.textContent).not.toContain('Admin');
  });

  it('signale le rôle admin', () => {
    expect(render('admin').textContent).toContain('Admin');
  });

  it('déconnecte au clic', () => {
    render('player').querySelector('button')?.click();

    expect(logout).toHaveBeenCalled();
  });
});
