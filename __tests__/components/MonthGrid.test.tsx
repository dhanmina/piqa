import { render, screen } from '@testing-library/react-native';
import { MonthGrid } from '../../components/MonthGrid';

test('shows a photo for a captured day', async () => {
  await render(
    <MonthGrid
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

test('shows a day-number badge over a captured photo', async () => {
  await render(
    <MonthGrid
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
});

test('shows a photo count alongside the day number for multi-capture days', async () => {
  await render(
    <MonthGrid
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
  expect(screen.getByText('7 · 2')).toBeTruthy();
});

test('shows a frozen indicator on a frozen day', async () => {
  await render(
    <MonthGrid
      leadingBlanks={0}
      days={[{ day: 2, imageUrl: null, imageUrls: [], captureIds: [], state: 'frozen' }]}
    />
  );
  expect(screen.getByTestId('frozen-icon-2')).toBeTruthy();
});

test('renders leading blank cells to align the first day by weekday', async () => {
  await render(
    <MonthGrid
      leadingBlanks={3}
      days={[{ day: 1, imageUrl: null, imageUrls: [], captureIds: [], state: 'future' }]}
    />
  );
  expect(screen.getByTestId('blank-cell-0')).toBeTruthy();
  expect(screen.getByTestId('blank-cell-2')).toBeTruthy();
  expect(screen.queryByTestId('blank-cell-3')).toBeNull();
});
