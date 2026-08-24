import React from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test } from 'vitest';

import TSHeader, { selectMenuKey } from './TSHeader';
import rootReducer from '../../reducers';

// Renders the current pathname so tests can observe that navigation happened
// through the router instead of a document reload.
const RouteProbe = () => {
  const { pathname } = useLocation();
  return <div data-testid="route-probe">{pathname}</div>;
};

// Issue #36: the header derived its selected item from window.location by
// earliest-substring position and rendered every menu entry as a plain
// anchor, so navigation reloaded the page and the highlight never followed
// the router. After the fix the header is driven by useLocation and its
// entries are router Links.

// Issue #41: the header now has two layouts. Below the md breakpoint the
// eight sections collapse into a dropdown; at and above it the horizontal
// menu renders as before. Every test pins its viewport explicitly through
// the shared setupTests helper instead of depending on the ambient stub.
const renderHeaderAt = (path, { viewport = 1280 } = {}) => {
  setMatchMediaViewport(viewport);
  return render(
    <Provider store={createStore(rootReducer)}>
      <MemoryRouter initialEntries={[path]}>
        <TSHeader />
        <Routes>
          <Route path="*" element={<RouteProbe />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
};

const menuItem = (name) => screen.getByRole('menuitem', { name });

const isSelected = (item) =>
  item.classList.contains('ant-menu-item-selected') ||
  item.getAttribute('aria-selected') === 'true';

afterEach(() => {
  cleanup();
  // Drop the viewport override so the next render starts from the default
  // narrow stub until it pins its own width.
  setMatchMediaViewport();
});

describe('TSHeader active menu derivation', () => {
  test('selects the exact section on a list route', () => {
    renderHeaderAt('/simulation');
    expect(isSelected(menuItem(/simulation/i))).toBe(true);
  });

  test('keeps the section highlighted on a deep link into it', () => {
    renderHeaderAt('/data-recorders/rec-1');
    // Specificity beats position: the recorder detail page belongs to the
    // Data Recorder menu, not to whichever prefix happens to sit earliest
    // in the path.
    expect(isSelected(menuItem(/data recorder/i))).toBe(true);
    expect(isSelected(menuItem(/test campaign/i))).toBe(false);
  });

  test('does not match section names embedded mid-path', () => {
    renderHeaderAt('/logs/test-campaigns');
    expect(isSelected(menuItem(/test campaign/i))).toBe(false);
  });

  test('maps every menu key through the shared matcher', () => {
    expect(selectMenuKey('/')).toBe(null);
    expect(selectMenuKey('/test-campaigns')).toBe('0');
    expect(selectMenuKey('/test-campaigns/camp-9')).toBe('0');
    expect(selectMenuKey('/test-cases/tc-1')).toBe('1');
    expect(selectMenuKey('/models/m-1')).toBe('2');
    expect(selectMenuKey('/simulation')).toBe('3');
    expect(selectMenuKey('/data-recorders')).toBe('4');
    expect(selectMenuKey('/data-sets/ds-1')).toBe('5');
    expect(selectMenuKey('/data-storage')).toBe('6');
    expect(selectMenuKey('/reports')).toBe('7');
    expect(selectMenuKey('/logs/test-campaigns')).toBe(null);
  });
});

describe('TSHeader client-side navigation', () => {
  test('a menu click moves between sections without leaving the page', async () => {
    renderHeaderAt('/models');
    await userEvent.click(screen.getByRole('link', { name: /test campaign/i }));
    // The router moved: the probe shows the client-side location changed and
    // the highlight follows it. A native anchor would have reloaded the
    // document, so the route could never change.
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/test-campaigns');
    expect(isSelected(menuItem(/test campaign/i))).toBe(true);
    expect(isSelected(menuItem(/topology/i))).toBe(false);
  });
});

describe('TSHeader accessibility (issue #39)', () => {
  test('marks the active section with aria-current="page"', () => {
    renderHeaderAt('/simulation');
    // Programmatic current-page indication for assistive tech, independent
    // of antd's visual highlight class.
    expect(
      menuItem(/simulation/i).querySelector('a[aria-current="page"]')
    ).not.toBeNull();
  });

  test('does not mark inactive sections as current', () => {
    renderHeaderAt('/simulation');
    expect(
      menuItem(/topology/i).querySelector('a[aria-current="page"]')
    ).toBeNull();
  });

  test('the logo image describes what it represents, not just "Logo"', () => {
    renderHeaderAt('/models');
    const logo = screen.getByAltText(/taS dashboard home/i);
    expect(logo).toHaveAttribute('alt', 'TaS dashboard home');
  });
});

describe('TSHeader collapsed navigation on narrow viewports (issue #41)', () => {
  test('the eight sections are not laid out horizontally below md', () => {
    renderHeaderAt('/simulation', { viewport: 640 });
    expect(screen.queryByRole('menuitem', { name: /simulation/i })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /topology/i })).toBeNull();
  });

  test('a labelled trigger replaces the horizontal menu below md', () => {
    renderHeaderAt('/simulation', { viewport: 640 });
    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  test('the trigger opens by keyboard and exposes every section', async () => {
    renderHeaderAt('/', { viewport: 640 });
    const trigger = screen.getByRole('button', { name: /open navigation menu/i });
    // A native button sits in the tab order, so keyboard users reach it by
    // tabbing; Enter then activates it exactly like a pointer click.
    trigger.focus();
    expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close navigation menu/i })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });
    expect(screen.getByRole('menuitem', { name: /simulation/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /report/i })).toBeInTheDocument();
  });

  test('a section chosen from the collapsed menu navigates client-side', async () => {
    renderHeaderAt('/models', { viewport: 640 });
    await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    await userEvent.click(screen.getByRole('link', { name: /simulation/i }));
    expect(screen.getByTestId('route-probe')).toHaveTextContent('/simulation');
  });

  test('aria-current follows the router inside the collapsed menu', async () => {
    renderHeaderAt('/simulation', { viewport: 640 });
    await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    const current = screen.getByRole('link', { name: /simulation/i });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /topology/i })).not.toHaveAttribute(
      'aria-current'
    );
  });

  test('at md and above the horizontal menu renders without a trigger', () => {
    renderHeaderAt('/simulation', { viewport: 800 });
    expect(menuItem(/simulation/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /navigation menu/i })
    ).toBeNull();
  });
});
