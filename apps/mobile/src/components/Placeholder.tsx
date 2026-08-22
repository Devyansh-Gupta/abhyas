import { View, Text } from 'react-native';

export default function Placeholder({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="text-dim">{title} — wired in P1 (see GitHub issues)</Text>
    </View>
  );
}
