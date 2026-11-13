import { TestBed } from '@angular/core/testing';
import { LoginPage } from './login-page';

function render(error?: string): HTMLElement {
  TestBed.configureTestingModule({ imports: [LoginPage] });
  const fixture = TestBed.createComponent(LoginPage);
  if (error) fixture.componentRef.setInput('error', error);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('LoginPage', () => {
  it('propose la connexion Discord, sans message d’erreur par défaut', () => {
    const page = render();

    expect(page.querySelector('a')?.getAttribute('href')).toBe('/api/auth/discord');
    expect(page.querySelector('[role=alert]')).toBeNull();
  });

  it('explique le refus à un non-membre du serveur', () => {
    expect(render('not_member').querySelector('[role=alert]')?.textContent).toContain("n'est pas membre du serveur");
  });

  it('ignore un code d’erreur inconnu', () => {
    expect(render('<script>').querySelector('[role=alert]')).toBeNull();
  });
});
