import type { Component } from 'react';

declare global {
  namespace JSX {
    interface ElementClass {
      render(): React.ReactNode;
    }
  }
}
