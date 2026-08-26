import { render, screen } from '@testing-library/react-native';
import { PeekBackCard } from '../../components/PeekBackCard';

test('renders the peek label when a peek exists', async () => {
  await render(<PeekBackCard peek={{ imageUrl: 'https://example.com/x.jpg', label: 'last week' }} />);
  expect(screen.getByText(/last week/i)).toBeTruthy();
});

test('renders nothing meaningful when peek is null', async () => {
  await render(<PeekBackCard peek={null} />);
  expect(screen.queryByText(/last week/i)).toBeNull();
});
