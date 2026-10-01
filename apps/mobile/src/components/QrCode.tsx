import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
// The core encoder only: the package entry pulls Node / canvas renderers.
import { create } from "qrcode/lib/core/qrcode";

/** Light margin around the code, in modules (the spec asks for 4). */
const QUIET_ZONE = 4;

/**
 * QR code drawn with plain Views (no SVG native module): each row is split
 * into runs of dark modules, so a typical code is a few hundred Views.
 */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const rows = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: "M" });
    const runs: { row: number; start: number; length: number }[][] = [];
    for (let row = 0; row < modules.size; row++) {
      const line: { row: number; start: number; length: number }[] = [];
      let start = -1;
      for (let col = 0; col <= modules.size; col++) {
        const dark = col < modules.size && modules.get(row, col);
        if (dark && start < 0) start = col;
        if (!dark && start >= 0) {
          line.push({ row, start, length: col - start });
          start = -1;
        }
      }
      runs.push(line);
    }
    return { count: modules.size, runs };
  }, [value]);

  const cell = size / (rows.count + QUIET_ZONE * 2);
  return (
    <View
      style={[styles.background, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="QR code"
    >
      {rows.runs.flat().map(({ row, start, length }) => (
        <View
          key={`${row}-${start}`}
          style={[
            styles.dark,
            {
              top: (row + QUIET_ZONE) * cell,
              left: (start + QUIET_ZONE) * cell,
              width: length * cell + 0.5, // overlap a hair: no seams between runs
              height: cell + 0.5,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: "#FFFFFF", borderRadius: 12 },
  dark: { position: "absolute", backgroundColor: "#000000" },
});
