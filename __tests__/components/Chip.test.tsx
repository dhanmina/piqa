import { render, screen } from '@testing-library/react-native';
import { Chip } from '../../components/Chip';

test('renders the given label', async () => {
  await render(<Chip label="Rest days: 2 left this week" />);
  expect(screen.getByText('Rest days: 2 left this week')).toBeTruthy();
});
