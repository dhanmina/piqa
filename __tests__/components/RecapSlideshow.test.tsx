import { render, screen } from '@testing-library/react-native';
import { RecapSlideshow } from '../../components/RecapSlideshow';

test('renders the first photo of the recap', async () => {
  await render(
    <RecapSlideshow
      kind="week"
      photos={[
        { url: 'a.jpg', path: 'a.jpg', capturedAt: '2026-08-25' },
        { url: 'b.jpg', path: 'b.jpg', capturedAt: '2026-08-26' },
      ]}
    />
  );
  expect(screen.getByTestId('recap-image-a.jpg')).toBeTruthy();
});

test('opens on the stat card when there are enough captures to earn one', async () => {
  const photos = Array.from({ length: 5 }, (_, i) => ({
    url: `${i}.jpg`,
    path: `${i}.jpg`,
    capturedAt: `2026-08-${20 + i}`,
  }));
  await render(<RecapSlideshow kind="year" photos={photos} />);
  expect(screen.getByTestId('recap-stats')).toBeTruthy();
});

test('reports the true total on the stat card even when the photo set is sampled down', async () => {
  const photos = Array.from({ length: 300 }, (_, i) => ({
    url: `${i}.jpg`,
    path: `${i}.jpg`,
    capturedAt: `2026-01-01`,
  }));
  await render(<RecapSlideshow kind="year" photos={photos} />);
  expect(screen.getByText('300')).toBeTruthy();
});

test('renders nothing when there are no photos', async () => {
  const { toJSON } = await render(<RecapSlideshow kind="week" photos={[]} />);
  expect(toJSON()).toBeNull();
});
