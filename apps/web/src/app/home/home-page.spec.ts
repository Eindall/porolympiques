import { TestBed } from '@angular/core/testing';
import { HomePage } from './home-page';

describe('HomePage', () => {
  it('affiche le nom du site', async () => {
    await TestBed.configureTestingModule({ imports: [HomePage] }).compileComponents();
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const title = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(title?.textContent).toContain('Porolympiques');
  });
});
