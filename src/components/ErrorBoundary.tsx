import React, { Component } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, typeScale } from "@/components/tokens";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Top-level error boundary that catches render crashes in the tab navigator
 * and shows a safe fallback instead of a white screen. Logs to Sentry when
 * available (the wrapRoot call in _layout.tsx sets up the Sentry client).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev; Sentry captures it if the client is initialised.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>Try closing and reopening the app.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.title,
    color: colors.paper,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: "center",
  },
});
