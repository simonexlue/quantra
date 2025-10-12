import React from "react";
import { StyleSheet } from "react-native";
import { FAB, useTheme } from "react-native-paper";

export type MicButtonProps = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
};

export default function MicButton({ onPress, loading, disabled, label }: MicButtonProps) {
  const theme = useTheme();
  return (
    <FAB
      style={[styles.fab, { backgroundColor: theme.colors.primary }]}
      icon={loading ? "waveform" : "microphone"}
      color="#FFFFFF"
      label={label}
      onPress={onPress}
      disabled={disabled}
      loading={!!loading}
      testID="mic-button"
    />
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 30,
    bottom: 30,
    borderRadius: 30,
  },
});