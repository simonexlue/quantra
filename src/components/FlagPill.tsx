import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

type Flag = "ok" | "low" | "out" | "OK" | "LOW" | "OUT" | null | undefined;

const COLORS = {
  ok:  "#4CAF50", // green
  low: "#00BCD4", // teal
  out: "#E53935", // red
} as const;

export default memo(function FlagPill({ flag }: { flag: Flag }) {
  if (!flag) return null;

  const f = String(flag).toLowerCase() as keyof typeof COLORS;
  const bg = COLORS[f] ?? COLORS.ok;

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={styles.label}>{f.toUpperCase()}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
    minWidth: 44,
    alignItems: "center",
  },
  label: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
