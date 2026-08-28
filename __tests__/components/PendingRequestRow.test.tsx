import { fireEvent, render, screen } from '@testing-library/react-native';
import { PendingRequestRow } from '../../components/PendingRequestRow';
import type { PendingRequest } from '../../lib/buddies';

const request: PendingRequest = {
  requestId: 'req-1',
  requesterId: 'u1',
  username: 'bob',
  displayName: 'Bob',
  avatarUrl: null,
};

test('renders the requester name', async () => {
  await render(<PendingRequestRow request={request} onAccept={jest.fn()} onDecline={jest.fn()} />);
  expect(screen.getByText(/Bob wants to add you/)).toBeTruthy();
});

test('tapping Accept calls onAccept', async () => {
  const onAccept = jest.fn();
  await render(<PendingRequestRow request={request} onAccept={onAccept} onDecline={jest.fn()} />);
  fireEvent.press(screen.getByText('Accept'));
  expect(onAccept).toHaveBeenCalled();
});

test('tapping Decline calls onDecline', async () => {
  const onDecline = jest.fn();
  await render(<PendingRequestRow request={request} onAccept={jest.fn()} onDecline={onDecline} />);
  fireEvent.press(screen.getByText('Decline'));
  expect(onDecline).toHaveBeenCalled();
});

test('disables both buttons while busy', async () => {
  await render(<PendingRequestRow request={request} onAccept={jest.fn()} onDecline={jest.fn()} busy />);
  expect(screen.getByText('Decline').props.accessibilityState?.disabled ?? screen.getByRole('button', { name: /Decline/i })).toBeTruthy();
});
