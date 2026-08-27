import { render, screen } from '@testing-library/react-native';
import { MosaicGrid } from '../../components/MosaicGrid';

test('renders one tile per photo', async () => {
  await render(<MosaicGrid photos={['a.jpg', 'b.jpg', 'c.jpg']} />);
  expect(screen.getAllByTestId(/mosaic-tile-/)).toHaveLength(3);
});

test('renders nothing when there are no photos yet', async () => {
  await render(<MosaicGrid photos={[]} />);
  expect(screen.queryAllByTestId(/mosaic-tile-/)).toHaveLength(0);
});
