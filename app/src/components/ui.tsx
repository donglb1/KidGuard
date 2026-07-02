import React from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  TextInput,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtle}>{children}</Text>;
}

type BtnVariant = 'primary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const border = variant === 'ghost' ? colors.border : 'transparent';
  const fg = variant === 'ghost' ? colors.text : colors.primaryDark;
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : 1 },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textDim}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.sm },
  subtle: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  fieldLabel: { color: colors.textDim, marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
