import { render, screen } from '@testing-library/react-native';
import { RecapSlideshow } from '../../components/RecapSlideshow';

test('renders the first photo of the recap', async () => {
  await render(
    <RecapSlideshow
      photos={[
        { url: 'a.jpg', path: 'a.jpg' },
        { url: 'b.jpg', path: 'b.jpg' },
      ]}
    />
  );
  expect(screen.getByTestId('recap-image-0')).toBeTruthy();
});

test('renders nothing when there are no photos', async () => {
  const { toJSON } = await render(<RecapSlideshow photos={[]} />);
  expect(toJSON()).toBeNull();
});
