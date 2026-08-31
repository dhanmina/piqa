import { render, screen } from '@testing-library/react-native';
import { Chip } from '../../components/Chip';

test('renders each stat value and label', async () => {
  await render(
    <Chip
      stats={[
        { value: '2', label: 'Rest days left' },
        { value: '21d', label: 'Longest streak' },
      ]}
    />
  );
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText('Rest days left')).toBeTruthy();
  expect(screen.getByText('21d')).toBeTruthy();
  expect(screen.getByText('Longest streak')).toBeTruthy();
});
