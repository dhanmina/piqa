import { fireEvent, render, screen } from '@testing-library/react-native';
import { BuddyRow } from '../../components/BuddyRow';
import type { Buddy } from '../../lib/buddies';

const baseBuddy: Buddy = {
  id: 'u1',
  username: 'bob',
  displayName: 'Bob',
  avatarUrl: null,
  currentCount: 5,
  status: 'captured_today',
  todayCaptureId: 'cap-1',
  todayPhotoUrl: 'https://signed/bob.jpg',
  reactedByMe: false,
};

test('renders the buddy name and streak count', async () => {
  await render(<BuddyRow buddy={baseBuddy} onReact={jest.fn()} onRemove={jest.fn()} />);
  expect(screen.getByText('Bob')).toBeTruthy();
  expect(screen.getByText(/5 days/)).toBeTruthy();
});

test('tapping the reaction button calls onReact with the today capture id', async () => {
  const onReact = jest.fn();
  await render(<BuddyRow buddy={baseBuddy} onReact={onReact} onRemove={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("React to Bob's photo"));
  expect(onReact).toHaveBeenCalledWith('cap-1');
});

test('disables the reaction button once already reacted', async () => {
  await render(<BuddyRow buddy={{ ...baseBuddy, reactedByMe: true }} onReact={jest.fn()} onRemove={jest.fn()} />);
  expect(screen.getByLabelText('Already reacted').props.accessibilityState.disabled).toBe(true);
});

test('renders no photo or reaction button when there is no capture today', async () => {
  await render(
    <BuddyRow
      buddy={{ ...baseBuddy, status: 'none', todayCaptureId: null, todayPhotoUrl: null }}
      onReact={jest.fn()}
      onRemove={jest.fn()}
    />
  );
  expect(screen.queryByLabelText("React to Bob's photo")).toBeNull();
});

test('tapping the remove button calls onRemove', async () => {
  const onRemove = jest.fn();
  await render(<BuddyRow buddy={baseBuddy} onReact={jest.fn()} onRemove={onRemove} />);
  fireEvent.press(screen.getByLabelText('Remove Bob as a buddy'));
  expect(onRemove).toHaveBeenCalled();
});
