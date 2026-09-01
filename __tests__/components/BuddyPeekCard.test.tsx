import { fireEvent, render, screen } from '@testing-library/react-native';
import { BuddyPeekCard } from '../../components/BuddyPeekCard';
import type { BuddyPeek } from '../../lib/buddies';

const basePeek: BuddyPeek = {
  buddyId: 'u1',
  buddyUsername: 'bob',
  buddyDisplayName: 'Bob',
  buddyAvatarUrl: null,
  myCaptureId: 'cap-mine',
  myPhotoUrl: 'https://signed/mine.jpg',
  buddyCaptureId: 'cap-bob',
  buddyPhotoUrl: 'https://signed/bob.jpg',
  label: 'last week',
  reactedByMe: false,
};

test('renders the buddy name and offset label', async () => {
  await render(<BuddyPeekCard peek={basePeek} onPress={jest.fn()} onReact={jest.fn()} />);
  expect(screen.getByText(/You & Bob/)).toBeTruthy();
  expect(screen.getByText('last week')).toBeTruthy();
});

test('tapping the photos calls onPress', async () => {
  const onPress = jest.fn();
  await render(<BuddyPeekCard peek={basePeek} onPress={onPress} onReact={jest.fn()} />);
  fireEvent.press(screen.getByLabelText(/Buddy Peek photos, you and Bob, last week/));
  expect(onPress).toHaveBeenCalled();
});

test('tapping the reaction button calls onReact', async () => {
  const onReact = jest.fn();
  await render(<BuddyPeekCard peek={basePeek} onPress={jest.fn()} onReact={onReact} />);
  fireEvent.press(screen.getByLabelText("React to Bob's photo"));
  expect(onReact).toHaveBeenCalled();
});

test('disables the reaction button once already reacted', async () => {
  await render(<BuddyPeekCard peek={{ ...basePeek, reactedByMe: true }} onPress={jest.fn()} onReact={jest.fn()} />);
  expect(screen.getByLabelText('Already reacted').props.accessibilityState.disabled).toBe(true);
});
