import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';

import { fonts } from '@/components/tokens';

// TODO(fonts): Clash Display Semibold is not in the repo yet. Download from
// Fontshare, save as assets/fonts/ClashDisplay-Semibold.otf, then:
//   1. add to the map below:  'ClashDisplay-Semibold': require('@/assets/fonts/ClashDisplay-Semibold.otf'),
//   2. flip CLASH_DISPLAY_LOADED to true.
export const CLASH_DISPLAY_LOADED = false;

/** Family to use for display moments (Clash when present, else Instrument SemiBold). */
export const displayFamily = CLASH_DISPLAY_LOADED ? fonts.display : fonts.displayFallback;

export function useAppFonts() {
  return useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
}
