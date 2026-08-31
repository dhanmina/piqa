import { render, screen } from '@testing-library/react-native';
import { MonthGrid } from '../../components/MonthGrid';

test('shows a photo for a captured day', async () => {
  await render(
    <MonthGrid
      year={2026}
      month={8}
      leadingBlanks={0}
      days={[
        {
          day: 1,
          imageUrl: 'https://example.com/x.jpg',
          imageUrls: ['https://example.com/x.jpg'],
          captureIds: ['cap-1'],
          state: 'captured',
        },
      ]}
    />
  );
  expect(screen.getByTestId('day-photo-1')).toBeTruthy();
});

test('shows a day-number badge over a captured photo, with no multi-photo icon for a single photo', async () => {
  await render(
    <MonthGrid
      year={2026}
      month={8}
      leadingBlanks={0}
      days={[
        {
          day: 5,
          imageUrl: 'https://example.com/x.jpg',
          imageUrls: ['https://example.com/x.jpg'],
          captureIds: ['cap-1'],
          state: 'captured',
        },
      ]}
    />
  );
  expect(screen.getByTestId('day-badge-5')).toBeTruthy();
  expect(screen.getByText('5')).toBeTruthy();
  expect(screen.queryByTestId('multi-photo-icon-5')).toBeNull();
});

test('shows the multi-photo icon alongside the day number, in one badge, for multi-capture days', async () => {
  await render(
    <MonthGrid
      year={2026}
      month={8}
      leadingBlanks={0}
      days={[
        {
          day: 7,
          imageUrl: 'https://example.com/y.jpg',
          imageUrls: ['https://example.com/x.jpg', 'https://example.com/y.jpg'],
          captureIds: ['cap-1', 'cap-2'],
          state: 'captured',
        },
      ]}
    />
  );
  expect(screen.getByTestId('day-badge-7')).toBeTruthy();
  expect(screen.getByTestId('multi-photo-icon-7')).toBeTruthy();
  expect(screen.getByText('7')).toBeTruthy();
});

test('shows a frozen indicator on a frozen day', async () => {
  await render(
    <MonthGrid
      year={2026}
      month={8}
      leadingBlanks={0}
      days={[{ day: 2, imageUrl: null, imageUrls: [], captureIds: [], state: 'frozen' }]}
    />
  );
  expect(screen.getByTestId('frozen-icon-2')).toBeTruthy();
});

test('renders leading blank cells to align the first day by weekday', async () => {
  await render(
    <MonthGrid
      year={2026}
      month={8}
      leadingBlanks={3}
      days={[{ day: 1, imageUrl: null, imageUrls: [], captureIds: [], state: 'future' }]}
    />
  );
  expect(screen.getByTestId('blank-cell-0')).toBeTruthy();
  expect(screen.getByTestId('blank-cell-2')).toBeTruthy();
  expect(screen.queryByTestId('blank-cell-3')).toBeNull();
});
