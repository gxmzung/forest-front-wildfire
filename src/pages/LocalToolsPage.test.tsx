import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import LocalToolsPage, { isLocalToolsRoute } from './LocalToolsPage';
describe('independent local tools', () => {
  it('restricts the route to loopback and does not replace existing routes', () => {
    expect(isLocalToolsRoute('/local-tools', 'localhost')).toBe(true);
    expect(isLocalToolsRoute('/local-tools', '127.0.0.1')).toBe(true);
    expect(isLocalToolsRoute('/local-tools', 'wildfire.forest.tobeunicorn.kr')).toBe(false);
    expect(isLocalToolsRoute('/', 'localhost')).toBe(false);
    expect(isLocalToolsRoute('/device', 'localhost')).toBe(false);
  });
  it('renders without an incident or fake equipment and offers independent data controls', () => {
    const html = renderToStaticMarkup(createElement(LocalToolsPage));
    expect(html).toContain('내 현재 위치로 조회'); expect(html).toContain('통신 종류별 시험'); expect(html).toContain('위치 미선택'); expect(html).toContain('미시험');
    expect(html).not.toContain('상황판 준비 중'); expect(html).not.toContain('100%'); expect(html).not.toContain('기온</span><b>0');
    expect(html).toMatch(/disabled="">사건 위치로 조회/);
  });
});
