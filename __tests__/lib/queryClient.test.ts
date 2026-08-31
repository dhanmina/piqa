import { QueryClient } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';

test('queryClient is a configured QueryClient instance', () => {
  expect(queryClient).toBeInstanceOf(QueryClient);
});
