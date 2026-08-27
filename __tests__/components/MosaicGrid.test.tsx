import { render, screen } from '@testing-library/react-native';
import { MosaicGrid } from '../../components/MosaicGrid';

const photos = [
  { url: 'a.jpg', capturedAt: '2026-01-01' },
  { url: 'b.jpg', capturedAt: '2026-01-02' },
  { url: 'c.jpg', capturedAt: '2026-01-03' },
];

test('renders one tile per photo', async () => {
  await render(<MosaicGrid photos={photos} />);
  expect(screen.getAllByTestId(/mosaic-tile-/)).toHaveLength(3);
});

test('renders nothing when there are no photos yet', async () => {
  await render(<MosaicGrid photos={[]} />);
  expect(screen.queryAllByTestId(/mosaic-tile-/)).toHaveLength(0);
});
