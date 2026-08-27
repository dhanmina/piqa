import { render, screen } from '@testing-library/react-native';
import { PeekBackCard } from '../../components/PeekBackCard';

test('renders the peek label when a peek exists', async () => {
  await render(<PeekBackCard peek={{ imageUrl: 'https://example.com/x.jpg', label: 'last week' }} />);
  expect(screen.getByText(/last week/i)).toBeTruthy();
});
