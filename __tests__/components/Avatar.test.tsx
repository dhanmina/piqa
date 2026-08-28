import { render, screen } from '@testing-library/react-native';
import { Avatar } from '../../components/Avatar';

test('renders an image when a url is given', async () => {
  await render(<Avatar url="https://example.com/a.jpg" name="Dhan" />);
  expect(screen.getByLabelText('Profile photo')).toBeTruthy();
});

test('renders the first letter of the name when there is no url', async () => {
  await render(<Avatar url={null} name="Dhan" />);
  expect(screen.getByText('D')).toBeTruthy();
});

test('renders a custom accessibility label when given', async () => {
  await render(<Avatar url="https://example.com/a.jpg" name="Dhan" accessibilityLabel="Your profile photo" />);
  expect(screen.getByLabelText('Your profile photo')).toBeTruthy();
});
