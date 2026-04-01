import { useColorScheme as _useColorScheme } from 'react-native';
import { Colors } from './theme';

export function useThemeColors() {
  const scheme = _useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}
